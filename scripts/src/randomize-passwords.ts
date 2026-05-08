import pg from "pg";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const { Pool } = pg;

if (!process.env["DATABASE_URL"]) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });

function generatePassword(length = 20): string {
  return randomBytes(Math.ceil((length * 3) / 4))
    .toString("base64url")
    .slice(0, length);
}

async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ id: number; login: string }>(
      "SELECT id, login FROM users ORDER BY id"
    );

    if (rows.length === 0) {
      console.log("No users found in the database.");
      return;
    }

    console.log("Assigning unique random passwords to all users...\n");
    console.log("Save these credentials securely — they will not be shown again.\n");
    console.log("─".repeat(60));

    for (const row of rows) {
      const password = generatePassword(20);
      const hash = await bcrypt.hash(password, 12);
      await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, row.id]);
      console.log(`  login: ${row.login.padEnd(12)}  password: ${password}`);
    }

    console.log("─".repeat(60));
    console.log("\nAll passwords updated successfully.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
