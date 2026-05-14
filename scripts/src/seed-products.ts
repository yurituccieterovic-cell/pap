import { getUncachableStripeClient } from "./stripeClient.js";

const PLANS = [
  {
    name: "PAP Aluno II — Matéria Solicitada",
    description: "Acesso à disciplina escolhida dentro da árvore FUVEST. Exercícios IA inclusos.",
    tier: "2",
    monthlyBRL: 1990,
  },
  {
    name: "PAP Aluno III — Conteúdo Completo",
    description: "Acesso completo à área de Ciências: todas as disciplinas e conteúdos exigidos no FUVEST.",
    tier: "3",
    monthlyBRL: 2990,
  },
  {
    name: "PAP Aluno III.5 — Exercícios Adicionais",
    description: "Tudo do Aluno III + exercícios adicionais gerados por IA para reforço intensivo.",
    tier: "35",
    monthlyBRL: 3990,
  },
  {
    name: "PAP Aluno IV — Conhecimento Humano",
    description: "Acesso total: Ciências, Empirismo, Filosofia e Religiões. Toda a árvore do conhecimento humano.",
    tier: "4",
    monthlyBRL: 4990,
  },
];

async function archiveOldProducts(stripe: Awaited<ReturnType<typeof getUncachableStripeClient>>) {
  const oldNames = ["PAP Explorador", "PAP Completo"];
  for (const name of oldNames) {
    const existing = await stripe.products.search({ query: `name:'${name}' AND active:'true'` });
    for (const p of existing.data) {
      await stripe.products.update(p.id, { active: false });
      console.log(`  Arquivado produto antigo: ${p.name} (${p.id})`);
    }
  }
}

async function seedProducts() {
  const stripe = await getUncachableStripeClient();
  console.log("Configurando planos PAP no Stripe...\n");

  await archiveOldProducts(stripe);
  console.log("");

  for (const plan of PLANS) {
    const existing = await stripe.products.search({
      query: `name:'${plan.name}' AND active:'true'`,
    });

    if (existing.data.length > 0) {
      const p = existing.data[0];
      console.log(`  ${plan.name} já existe: ${p.id}`);
      const prices = await stripe.prices.list({ product: p.id, active: true, limit: 5 });
      prices.data.forEach((pr) =>
        console.log(`    Preço: R$${((pr.unit_amount ?? 0) / 100).toFixed(2)}/mês — ${pr.id}`),
      );
      continue;
    }

    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: { tier: plan.tier },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.monthlyBRL,
      currency: "brl",
      recurring: { interval: "month" },
    });

    console.log(`  [ok] ${product.name}`);
    console.log(`       tier: ${plan.tier} | R$${plan.monthlyBRL / 100}/mês | price: ${price.id}`);
  }

  console.log("\nPronto.");
}

seedProducts().catch((err) => {
  console.error("Erro:", (err as Error).message);
  process.exit(1);
});
