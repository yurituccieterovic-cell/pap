import { Router } from "express";
import { db } from "@workspace/db";
import { nodesTable, exercisesTable, exerciseAttemptsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

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
  const nodeCode = String(req.query["nodeCode"] ?? "");
  if (!nodeCode) {
    res.status(400).json({ error: "nodeCode obrigatório" });
    return;
  }

  const [node] = await db
    .select()
    .from(nodesTable)
    .where(eq(nodesTable.code, nodeCode))
    .limit(1);

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
    try {
      exercises = await generateExercises(nodeCode, node.title, node.content);
    } catch (err) {
      req.log.error({ err }, "Failed to generate exercises");
      if (exercises.length === 0) {
        res.status(503).json({ error: "Não foi possível gerar exercícios agora" });
        return;
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

  const correct = selectedOption === exercise.correctOption ? 1 : 0;

  await db.insert(exerciseAttemptsTable).values({
    userId: req.session.userId ?? null,
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
