import app from "./app";
import { logger } from "./lib/logger";
import { seedDatabase, enforceUniquePasswords } from "./lib/bootstrap";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function initStripe(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return;

  try {
    await runMigrations({ databaseUrl });
    const stripeSync = await getStripeSync();
    const webhookBase = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    await stripeSync.findOrCreateManagedWebhook(`${webhookBase}/api/stripe/webhook`);
    stripeSync.syncBackfill().catch((err: unknown) => logger.warn({ err }, "stripe backfill warning"));
    logger.info("stripe initialized");
  } catch (err) {
    logger.warn({ err }, "stripe init skipped — connect via Integrations tab to enable payments");
  }
}

seedDatabase()
  .then(() => enforceUniquePasswords())
  .then(() => initStripe())
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "bootstrap failed — refusing to start");
    process.exit(1);
  });
