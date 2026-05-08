import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { logger } from "./logger";

const DEFAULT_PASSWORD = "pap";

/**
 * Checks all built-in user accounts for the known default shared password.
 * If any account is found still using that password the server refuses to
 * start and instructs the operator to run the manual rotation script, which
 * prints new credentials exactly once without writing them to any log file.
 *
 * This guard runs before app.listen() so the application can never serve
 * requests while a known shared default credential is in place.
 */
export async function enforceUniquePasswords(): Promise<void> {
  const users = await db.select().from(usersTable);

  const affected: string[] = [];

  for (const user of users) {
    if (!user.passwordHash || user.passwordHash.length === 0) {
      continue;
    }
    const isDefault = await bcrypt.compare(DEFAULT_PASSWORD, user.passwordHash);
    if (isDefault) {
      affected.push(user.login);
    }
  }

  if (affected.length === 0) {
    logger.info("bootstrap: all accounts have unique passwords — OK");
    return;
  }

  logger.error(
    { accounts: affected },
    "bootstrap: one or more accounts still use the shared default password. " +
      "Run `pnpm --filter @workspace/scripts run randomize-passwords` to assign " +
      "unique passwords and capture the output securely, then restart the server."
  );
  process.exit(1);
}
