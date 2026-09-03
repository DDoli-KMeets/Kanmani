import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

let pool: Pool | undefined;
let db: NodePgDatabase<typeof schema> | undefined;

/**
 * Lazily creates a single shared connection pool for the process. Nest's
 * DatabaseModule wraps this so every service injects the same instance
 * instead of each opening its own connections.
 */
export function getDb(): NodePgDatabase<typeof schema> {
  if (!db) {
    pool = new Pool({ connectionString: requireDatabaseUrl() });
    db = drizzle(pool, { schema });
  }
  return db;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
  db = undefined;
}

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy apps/api/.env.example to apps/api/.env and fill it in.",
    );
  }
  return url;
}

export type Database = NodePgDatabase<typeof schema>;
export { schema };
