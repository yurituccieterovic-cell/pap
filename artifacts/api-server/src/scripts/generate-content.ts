import { db, nodesTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { eq } from "drizzle-orm";

async function generateRichContent(title: string, subtitle: string | null, code: string): Promise<string> {
  const area = code.length <= 2 ? "macroárea" : code.length <= 3 ? "disciplina" : "tópico";
  const prompt = `Você é um professor especialista no vestibular FUVEST 2026. Escreva um resumo educacional completo sobre o ${area}: "${title}"${subtitle ? ` (${subtitle})` : ""}.

O texto deve ter 3 parágrafos curtos:
1. O que é este tema e sua importância para o vestibular FUVEST
2. Os principais conceitos e subtópicos cobrados na prova
3. Dica de estudo: o que a FUVEST mais cobra e como se preparar

Escreva em português claro, direto e motivador para um estudante do ensino médio. Sem bullets, sem títulos, só parágrafos. Máximo 220 palavras no total.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  return (response.choices[0]?.message?.content ?? "").trim();
}

async function main() {
  const nodes = await db.select().from(nodesTable);
  console.log(`Gerando conteúdo para ${nodes.length} nós...`);

  let ok = 0;
  let fail = 0;

  for (const node of nodes) {
    if (node.content && node.content.length > 150) {
      console.log(`  [skip] ${node.code}`);
      ok++;
      continue;
    }
    try {
      const content = await generateRichContent(node.title, node.subtitle ?? null, node.code);
      await db.update(nodesTable).set({ content }).where(eq(nodesTable.code, node.code));
      console.log(`  [ok] ${node.code} — ${node.title} (${content.length} chars)`);
      ok++;
    } catch (err) {
      console.error(`  [erro] ${node.code} —`, (err as Error).message);
      fail++;
    }
  }

  console.log(`\nConcluído: ${ok} ok, ${fail} erros`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Falha fatal:", err);
  process.exit(1);
});
