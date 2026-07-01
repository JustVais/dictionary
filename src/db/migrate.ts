import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

config({ path: ".env.local" });

// DDL over a pooled/transaction-mode PgBouncer connection (Neon's default
// injected DATABASE_URL) can be unreliable — prefer the unpooled/direct
// connection string for migrations when available. Falls back to
// DATABASE_URL for local Docker, where there's no pooled/unpooled split.
const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

async function main() {
  const pool = new Pool({ connectionString });
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  await pool.end();
  console.log("Migrations applied.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
