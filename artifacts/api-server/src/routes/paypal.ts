import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { paypalFetch, getPayPalCredentials } from "../paypalClient";

const router: IRouter = Router();

interface PayPalPlanRow {
  tier: number;
  plan_id: string;
  product_id: string;
  name: string;
  monthly_brl: number;
}

interface PayPalSubscription {
  id: string;
  status: string;
  plan_id: string;
  custom_id?: string;
  subscriber?: { payer_id?: string; email_address?: string };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* ── GET /api/paypal/client-id ───────────────────────────────────────────── */
router.get("/paypal/client-id", async (_req, res): Promise<void> => {
  try {
    const { clientId, baseUrl } = await getPayPalCredentials();
    res.json({ clientId, env: baseUrl.includes("sandbox") ? "sandbox" : "live" });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/* ── GET /api/paypal/plans ───────────────────────────────────────────────── */
router.get("/paypal/plans", async (_req, res): Promise<void> => {
  try {
    const rows = await db.execute(
      sql`SELECT tier, plan_id, product_id, name, monthly_brl FROM paypal_plans ORDER BY tier ASC`,
    );
    res.json({ plans: rows.rows as unknown as PayPalPlanRow[] });
  } catch {
    res.json({ plans: [] });
  }
});

/* ── POST /api/paypal/create-subscription ────────────────────────────────── */
/* Server-side subscription creation. Binds custom_id=userId so sync-tier can
   verify the subscription truly belongs to the calling user. Body: { planId } */
router.post("/paypal/create-subscription", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Autenticação necessária" });
    return;
  }
  const { planId } = req.body as { planId?: string };
  if (!planId || typeof planId !== "string") {
    res.status(400).json({ error: "planId obrigatório" });
    return;
  }
  try {
    const planRows = await db.execute(
      sql`SELECT tier FROM paypal_plans WHERE plan_id = ${planId} LIMIT 1`,
    );
    if (planRows.rows.length === 0) {
      res.status(400).json({ error: "Plano PayPal desconhecido" });
      return;
    }

    const APP_URL = `https://${process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost"}`;
    const sub = await paypalFetch<{ id: string }>("/v1/billing/subscriptions", {
      method: "POST",
      body: {
        plan_id: planId,
        custom_id: String(req.session.userId),
        application_context: {
          brand_name: "PAP — Sociedade Tucci",
          locale: "pt-BR",
          shipping_preference: "NO_SHIPPING",
          user_action: "SUBSCRIBE_NOW",
          return_url: `${APP_URL}/?paypal=success`,
          cancel_url: `${APP_URL}/?paypal=cancel`,
        },
      },
    });
    res.json({ id: sub.id });
  } catch (err) {
    req.log.error(err, "paypal create-subscription failed");
    res.status(500).json({ error: "Falha ao criar assinatura PayPal" });
  }
});

/* ── POST /api/paypal/sync-tier ──────────────────────────────────────────── */
/* Body: { subscriptionId } — server fetches subscription from PayPal,
   verifies custom_id matches the authenticated user, requires ACTIVE status,
   then updates user.tier. Polls briefly because new subscriptions transition
   APPROVAL_PENDING → APPROVED → ACTIVE within a few seconds. */
router.post("/paypal/sync-tier", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Autenticação necessária" });
    return;
  }
  const { subscriptionId } = req.body as { subscriptionId?: string };
  if (!subscriptionId || typeof subscriptionId !== "string") {
    res.status(400).json({ error: "subscriptionId obrigatório" });
    return;
  }
  try {
    let sub: PayPalSubscription | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      sub = await paypalFetch<PayPalSubscription>(
        `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
        { method: "GET" },
      );
      if (sub.status === "ACTIVE") break;
      if (sub.status === "CANCELLED" || sub.status === "EXPIRED" || sub.status === "SUSPENDED") break;
      await sleep(1500);
    }

    if (!sub) {
      res.status(500).json({ error: "Falha ao ler assinatura PayPal" });
      return;
    }

    // CRITICAL: verify subscription belongs to the calling user
    if (sub.custom_id !== String(req.session.userId)) {
      req.log.warn(
        { userId: req.session.userId, subId: subscriptionId, customId: sub.custom_id },
        "paypal sync-tier: custom_id mismatch — possible impersonation attempt",
      );
      res.status(403).json({ error: "Assinatura não pertence a este usuário" });
      return;
    }

    if (sub.status !== "ACTIVE") {
      res.status(400).json({
        error: `Pagamento ainda não confirmado (status: ${sub.status}). Tente novamente em alguns instantes.`,
        status: sub.status,
      });
      return;
    }

    const planRows = await db.execute(
      sql`SELECT tier FROM paypal_plans WHERE plan_id = ${sub.plan_id} LIMIT 1`,
    );
    const planRow = planRows.rows[0] as { tier?: number } | undefined;
    if (!planRow?.tier) {
      res.status(400).json({ error: "Plano PayPal desconhecido" });
      return;
    }

    const allowedTiers = new Set([2, 3, 35, 4]);
    if (!allowedTiers.has(planRow.tier)) {
      res.status(400).json({ error: "Tier inválido" });
      return;
    }
    const newTier = planRow.tier;

    await db
      .update(usersTable)
      .set({ tier: newTier })
      .where(eq(usersTable.id, req.session.userId));

    await db.execute(
      sql`UPDATE users SET paypal_subscription_id = ${subscriptionId} WHERE id = ${req.session.userId}`,
    );

    req.session.userTier = newTier;
    res.json({ tier: newTier, status: sub.status, synced: true });
  } catch (err) {
    req.log.error(err, "paypal sync-tier failed");
    res.status(500).json({ error: "Falha ao sincronizar plano PayPal" });
  }
});

/* ── POST /api/paypal/cancel ─────────────────────────────────────────────── */
router.post("/paypal/cancel", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Autenticação necessária" });
    return;
  }
  try {
    const rows = await db.execute(
      sql`SELECT paypal_subscription_id FROM users WHERE id = ${req.session.userId}`,
    );
    const row = rows.rows[0] as { paypal_subscription_id?: string } | undefined;
    const subId = row?.paypal_subscription_id;
    if (!subId) {
      res.status(400).json({ error: "Nenhuma assinatura PayPal ativa" });
      return;
    }
    await paypalFetch(
      `/v1/billing/subscriptions/${encodeURIComponent(subId)}/cancel`,
      { method: "POST", body: { reason: "Cancelado pelo usuário" } },
    );
    await db.execute(
      sql`UPDATE users SET paypal_subscription_id = NULL, tier = 1 WHERE id = ${req.session.userId}`,
    );
    req.session.userTier = 1;
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "paypal cancel failed");
    res.status(500).json({ error: "Falha ao cancelar assinatura PayPal" });
  }
});

export default router;
