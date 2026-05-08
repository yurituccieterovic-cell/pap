import { Router } from "express";
import { db } from "@workspace/db";
import { nodesTable, exercisesTable, exerciseAttemptsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { canAccess, isInAllowedSubtree } from "../lib/canAccess";

const router = Router();

const generationInProgress = new Set<string>();

const RATE_LIMIT_WINDOW_MS = 60 * 1000;

const GENERATION_RATE_MAX = 5;
const userGenerationCounts = new Map<number, { count: number; windowStart: number }>();

const ATTEMPT_RATE_MAX = 60;
const userAttemptCounts = new Map<number, { count: number; windowStart: number }>();

function checkRateLimit(
  map: Map<number, { count: number; windowStart: number }>,
  userId: number,
  max: number,
): boolean {
  const now = Date.now();
  const entry = map.get(userId);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    map.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count += 1;
  return true;
}

async function generateExercises(nodeCode: string, nodeTitle: string, nodeContent: string | null) {
  const prompt = `Você é um professor especialista no vestibular FUVEST. Crie exatamente 3 questões de múltipla escolha sobre o tema: "${nodeTitle}".

Contexto do tema: ${nodeContent ?? nodeTitle}

Retorne APENAS um array JSON válido com exatamente 3 objetos. Cada objeto deve ter:
- "question": string com a pergunta
- "options": array com exatamente 4 strings (alternativas A, B, C, D)
- "correctOption": número inteiro 0-3 (índice da resposta correta no array options)
- "explanation": string curta explicando a resposta correta

Exemplo de formato:
[
  {
    "question": "O que é X?",
    "options": ["Opção A", "Opção B", "Opção C", "Opção D"],
    "correctOption": 1,
    "explanation": "A opção B está correta porque..."
  }
]

Retorne SOMENTE o array JSON, sem texto adicional, sem markdown.`;

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.choices[0]?.message?.content ?? "[]";
  const cleanText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(cleanText) as Array<{
    question: string;
    options: string[];
    correctOption: number;
    explanation: string;
  }>;

  const inserted: typeof exercisesTable.$inferSelect[] = [];
  for (const q of parsed.slice(0, 3)) {
    const [ex] = await db
      .insert(exercisesTable)
      .values({
        nodeCode,
        question: q.question,
        options: q.options,
        correctOption: q.correctOption,
        explanation: q.explanation,
      })
      .returning();
    if (ex) inserted.push(ex);
  }
  return inserted;
}

router.get("/exercises", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Autenticação necessária" });
    return;
  }

  const tier = req.session.userTier ?? 0;
  if (tier < 1) {
    res.status(403).json({ error: "Exercícios disponíveis a partir do nível Aluno I" });
    return;
  }

  const nodeCode = String(req.query["nodeCode"] ?? "");
  if (!nodeCode) {
    res.status(400).json({ error: "nodeCode obrigatório" });
    return;
  }

  if (!canAccess(nodeCode, tier)) {
    res.status(403).json({ error: "Acesso negado para o seu nível de conta" });
    return;
  }

  const allNodes = await db.select().from(nodesTable);
  const nodeMap = new Map(allNodes.map((n) => [n.code, n]));

  if (!isInAllowedSubtree(nodeCode, nodeMap, tier)) {
    res.status(403).json({ error: "Acesso negado para o seu nível de conta" });
    return;
  }

  const node = nodeMap.get(nodeCode);

  if (!node) {
    res.status(404).json({ error: "Nó não encontrado" });
    return;
  }

  let exercises = await db
    .select()
    .from(exercisesTable)
    .where(eq(exercisesTable.nodeCode, nodeCode))
    .limit(3);

  if (exercises.length < 3) {
    if (generationInProgress.has(nodeCode)) {
      if (exercises.length === 0) {
        res.status(503).json({ error: "Exercícios sendo gerados, tente novamente em instantes" });
        return;
      }
    } else {
      if (!checkRateLimit(userGenerationCounts, req.session.userId, GENERATION_RATE_MAX)) {
        res.status(429).json({ error: "Muitas requisições de geração. Tente novamente em breve." });
        return;
      }
      generationInProgress.add(nodeCode);
      try {
        exercises = await generateExercises(nodeCode, node.title, node.content);
      } catch (err) {
        req.log.error({ err }, "Failed to generate exercises");
        if (exercises.length === 0) {
          res.status(503).json({ error: "Não foi possível gerar exercícios agora" });
          return;
        }
      } finally {
        generationInProgress.delete(nodeCode);
      }
    }
  }

  res.json(
    exercises.map((e) => ({
      id: e.id,
      nodeCode: e.nodeCode,
      question: e.question,
      options: e.options as string[],
    }))
  );
});

router.post("/exercises/attempt", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Autenticação necessária" });
    return;
  }

  const tier = req.session.userTier ?? 0;
  if (tier < 1) {
    res.status(403).json({ error: "Exercícios disponíveis a partir do nível Aluno I" });
    return;
  }

  if (!checkRateLimit(userAttemptCounts, req.session.userId, ATTEMPT_RATE_MAX)) {
    res.status(429).json({ error: "Muitas tentativas. Tente novamente em breve." });
    return;
  }

  const { exerciseId, selectedOption } = req.body as { exerciseId: number; selectedOption: number };

  if (exerciseId === undefined || selectedOption === undefined) {
    res.status(400).json({ error: "exerciseId e selectedOption são obrigatórios" });
    return;
  }

  const [exercise] = await db
    .select()
    .from(exercisesTable)
    .where(eq(exercisesTable.id, exerciseId))
    .limit(1);

  if (!exercise) {
    res.status(404).json({ error: "Exercício não encontrado" });
    return;
  }

  if (!canAccess(exercise.nodeCode, tier)) {
    res.status(403).json({ error: "Acesso negado para o seu nível de conta" });
    return;
  }

  const allNodesForAttempt = await db.select().from(nodesTable);
  const attemptNodeMap = new Map(allNodesForAttempt.map((n) => [n.code, n]));
  if (!isInAllowedSubtree(exercise.nodeCode, attemptNodeMap, tier)) {
    res.status(403).json({ error: "Acesso negado para o seu nível de conta" });
    return;
  }

  const correct = selectedOption === exercise.correctOption ? 1 : 0;

  await db.insert(exerciseAttemptsTable).values({
    userId: req.session.userId,
    exerciseId,
    nodeCode: exercise.nodeCode,
    selectedOption,
    correct,
  });

  res.json({
    correct: correct === 1,
    correctOption: exercise.correctOption,
    explanation: exercise.explanation,
  });
});

export default router;
