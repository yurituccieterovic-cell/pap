import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const colCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'password_hash'
    `);

    if (colCheck.rows.length === 0) {
      await client.query(`ALTER TABLE users ADD COLUMN password_hash TEXT`);
      console.log("Added password_hash column");
    } else {
      console.log("password_hash column already exists");
    }

    const plainCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'password_plain'
    `);

    if (plainCheck.rows.length > 0) {
      const { rows } = await client.query<{ id: number; password_plain: string }>(
        "SELECT id, password_plain FROM users WHERE password_hash IS NULL OR password_hash = ''"
      );
      console.log(`Hashing passwords for ${rows.length} user(s)...`);
      for (const row of rows) {
        const hash = await bcrypt.hash(row.password_plain, 12);
        await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, row.id]);
        console.log(`  Hashed password for user id=${row.id}`);
      }
      await client.query(`ALTER TABLE users DROP COLUMN password_plain`);
      console.log("Dropped password_plain column");
    } else {
      console.log("password_plain column already removed");
    }

    await client.query(
      `ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL`
    );
    console.log("Enforced NOT NULL on password_hash column");

    await client.query("COMMIT");
    console.log("Migration complete.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
