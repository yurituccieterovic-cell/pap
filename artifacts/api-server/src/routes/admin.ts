import { Router, type IRouter } from "express";
import { db, nodesTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

async function generateRichContent(
  title: string,
  subtitle: string | null,
  code: string,
): Promise<string> {
  const area = code.length <= 2 ? "macroárea" : code.length <= 3 ? "disciplina" : "tópico";
  const prompt = `Você é um professor especialista no vestibular FUVEST 2026. Escreva um resumo educacional completo sobre o ${area}: "${title}"${subtitle ? ` (${subtitle})` : ""}.

O texto deve ter 3 parágrafos curtos:
1. O que é este tema e sua importância para o vestibular FUVEST
2. Os principais conceitos e subtópicos cobrados na prova
3. Dica de estudo: o que a FUVEST mais cobra e como se preparar

Escreva em português claro, direto e motivador para um estudante do ensino médio. Sem bullets, sem títulos, só parágrafos. Máximo 220 palavras no total.`;

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  return (response.choices[0]?.message?.content ?? "").trim();
}

router.post("/admin/generate-content", async (req, res): Promise<void> => {
  const tier = req.session.userTier ?? 0;
  if (tier < 5) {
    res.status(403).json({ error: "Apenas administradores podem usar esta rota" });
    return;
  }

  try {
    const nodes = await db.select().from(nodesTable);
    const results: { code: string; status: string }[] = [];

    for (const node of nodes) {
      try {
        const richContent = await generateRichContent(
          node.title,
          node.subtitle ?? null,
          node.code,
        );
        await db
          .update(nodesTable)
          .set({ content: richContent })
          .where(eq(nodesTable.code, node.code));
        results.push({ code: node.code, status: "ok" });
        req.log.info({ code: node.code }, "content generated");
      } catch (err) {
        results.push({ code: node.code, status: "error" });
        req.log.error({ code: node.code, err }, "content generation failed for node");
      }
    }

    res.json({ generated: results.filter((r) => r.status === "ok").length, results });
  } catch (err) {
    req.log.error(err, "admin generate-content failed");
    res.status(500).json({ error: "Falha na geração de conteúdo" });
  }
});

export default router;
