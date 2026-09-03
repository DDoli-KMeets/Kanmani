/**
 * Runs once before the whole e2e suite: applies every migration to the
 * kmeets_test database so tests always run against the real, current
 * schema rather than a hand-maintained fixture that can drift from it —
 * then wipes every table's data so each run starts from a clean slate.
 *
 * That second step matters because the suite uses fixed phone numbers
 * (+919000000001 etc.). Without it, re-running the suite more than five
 * times within an hour trips AuthService's real per-phone OTP rate limit
 * (5/hour) against leftover rows from earlier runs, and every test fails
 * with an unrelated-looking 400 — a real gap that bit this project during
 * development, not a hypothetical one.
 */
import * as path from "node:path";
import * as dotenv from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

export default async function globalSetup() {
  dotenv.config({ path: path.resolve(__dirname, "../.env.test") });

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../src/database/migrations") });

  const { rows } = await pool.query<{ tablename: string }>(
    `select tablename from pg_tables where schemaname = 'public'`,
  );
  if (rows.length > 0) {
    const tableList = rows.map((r) => `"${r.tablename}"`).join(", ");
    await pool.query(`truncate table ${tableList} restart identity cascade`);
  }

  await pool.end();
}
