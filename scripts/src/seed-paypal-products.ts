import { Pool } from "pg";

const PAYPAL_LIVE = "https://api-m.paypal.com";
const PAYPAL_SANDBOX = "https://api-m.sandbox.paypal.com";

const PLANS = [
  {
    tier: 2,
    name: "PAP Aluno II — Matéria Solicitada",
    description: "Acesso à disciplina escolhida da árvore FUVEST. Exercícios IA inclusos.",
    monthlyBRL: 1990,
  },
  {
    tier: 3,
    name: "PAP Aluno III — Conteúdo Completo",
    description: "Acesso completo à área de Ciências FUVEST.",
    monthlyBRL: 2990,
  },
  {
    tier: 35,
    name: "PAP Aluno III.5 — Exercícios Adicionais",
    description: "Tudo do Aluno III + exercícios adicionais de reforço.",
    monthlyBRL: 3990,
  },
  {
    tier: 4,
    name: "PAP Aluno IV — Conhecimento Humano",
    description: "Acesso total: Ciências, Empirismo, Filosofia e Religiões.",
    monthlyBRL: 4990,
  },
];

async function detectBaseUrl(clientId: string, clientSecret: string): Promise<string> {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  for (const base of [PAYPAL_LIVE, PAYPAL_SANDBOX]) {
    const r = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    if (r.ok) return base;
  }
  throw new Error("Credenciais PayPal inválidas em live e sandbox");
}

async function getToken(baseUrl: string, clientId: string, clientSecret: string): Promise<string> {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const r = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) throw new Error(`auth failed: ${r.status}`);
  const d = (await r.json()) as { access_token: string };
  return d.access_token;
}

async function pp<T>(baseUrl: string, token: string, method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`PayPal ${method} ${path} (${r.status}): ${t}`);
  }
  if (r.status === 204) return {} as T;
  return (await r.json()) as T;
}

async function main() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const databaseUrl = process.env.DATABASE_URL;
  if (!clientId || !clientSecret) throw new Error("PAYPAL_CLIENT_ID/SECRET ausentes");
  if (!databaseUrl) throw new Error("DATABASE_URL ausente");

  console.log("Detectando ambiente PayPal...");
  const baseUrl = await detectBaseUrl(clientId, clientSecret);
  console.log(`  ambiente: ${baseUrl.includes("sandbox") ? "SANDBOX" : "LIVE"}`);

  const token = await getToken(baseUrl, clientId, clientSecret);
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });

  try {
    console.log("\nCarregando planos existentes do DB...");
    const existing = await pool.query<{ tier: number; plan_id: string }>(
      "SELECT tier, plan_id FROM paypal_plans",
    );
    const existingByTier = new Map(existing.rows.map((r) => [r.tier, r.plan_id]));

    for (const plan of PLANS) {
      if (existingByTier.has(plan.tier)) {
        console.log(`  tier ${plan.tier}: já existe (${existingByTier.get(plan.tier)})`);
        continue;
      }

      console.log(`\n  tier ${plan.tier}: criando produto...`);
      const product = await pp<{ id: string }>(baseUrl, token, "POST", "/v1/catalogs/products", {
        name: plan.name,
        description: plan.description,
        type: "SERVICE",
        category: "EDUCATIONAL_AND_TEXTBOOKS",
      });
      console.log(`    produto: ${product.id}`);

      console.log(`    criando plano...`);
      const planObj = await pp<{ id: string }>(baseUrl, token, "POST", "/v1/billing/plans", {
        product_id: product.id,
        name: plan.name,
        description: plan.description,
        status: "ACTIVE",
        billing_cycles: [
          {
            frequency: { interval_unit: "MONTH", interval_count: 1 },
            tenure_type: "REGULAR",
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: {
              fixed_price: {
                value: (plan.monthlyBRL / 100).toFixed(2),
                currency_code: "BRL",
              },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee: { value: "0", currency_code: "BRL" },
          setup_fee_failure_action: "CONTINUE",
          payment_failure_threshold: 3,
        },
      });
      console.log(`    plano: ${planObj.id}`);

      await pool.query(
        "INSERT INTO paypal_plans (tier, plan_id, product_id, name, monthly_brl) VALUES ($1,$2,$3,$4,$5)",
        [plan.tier, planObj.id, product.id, plan.name, plan.monthlyBRL],
      );
      console.log(`    [ok] salvo no DB`);
    }

    console.log("\nPronto.");
    const final = await pool.query("SELECT tier, plan_id, name, monthly_brl FROM paypal_plans ORDER BY tier");
    console.table(final.rows);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Erro:", (err as Error).message);
  process.exit(1);
});
