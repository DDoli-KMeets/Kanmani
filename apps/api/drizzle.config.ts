import type { Config } from "drizzle-kit";
import "dotenv/config";

export default {
  schema: "./src/database/schema.ts",
  out: "./src/database/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:devpassword@localhost:5432/kmeets_dev",
  },
} satisfies Config;
