/**
 * Applies every migration under src/database/migrations that hasn't run yet
 * against DATABASE_URL. Safe to run repeatedly (already-applied migrations
 * are skipped) — this is what CI and the deployment pipeline call before
 * a new version of the API starts serving traffic.
 */
import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set — copy .env.example to .env first.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  console.log("Applying database migrations...");
  await migrate(db, { migrationsFolder: "./src/database/migrations" });
  console.log("Migrations applied successfully.");

  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
