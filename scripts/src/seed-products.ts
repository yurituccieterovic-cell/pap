import { getUncachableStripeClient } from "./stripeClient.js";

const PLANS = [
  {
    name: "PAP Explorador",
    description: "Acesso completo à árvore de Ciências (tier 2) + exercícios IA em todos os nós.",
    tier: "2",
    monthlyBRL: 2990,
  },
  {
    name: "PAP Completo",
    description:
      "Acesso total: Ciências + Empirismo + Filosofia + Religiões (tier 4). Todos os recursos.",
    tier: "4",
    monthlyBRL: 4990,
  },
];

async function seedProducts() {
  const stripe = await getUncachableStripeClient();
  console.log("Criando planos no Stripe...");

  for (const plan of PLANS) {
    const existing = await stripe.products.search({
      query: `name:'${plan.name}' AND active:'true'`,
    });

    if (existing.data.length > 0) {
      const p = existing.data[0];
      console.log(`  ${plan.name} já existe: ${p.id}`);
      const prices = await stripe.prices.list({ product: p.id, active: true, limit: 5 });
      prices.data.forEach((pr) =>
        console.log(`    Preço: R$${(pr.unit_amount ?? 0) / 100}/mês — ${pr.id}`),
      );
      continue;
    }

    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: { tier: plan.tier },
    });
    console.log(`  Produto criado: ${product.name} (${product.id})`);

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.monthlyBRL,
      currency: "brl",
      recurring: { interval: "month" },
    });
    console.log(`  Preço: R$${plan.monthlyBRL / 100}/mês (${price.id})`);
  }

  console.log("\nPronto. Execute novamente para ver os IDs dos precos para o checkout.");
}

seedProducts().catch((err) => {
  console.error("Erro:", err.message);
  process.exit(1);
});
