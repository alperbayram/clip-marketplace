import { defineConfig } from "drizzle-kit";

// DIRECT_URL lets production point drizzle-kit at Supabase's session-mode
// pooler (port 5432) for migrations, while the app itself runs against the
// transaction-mode pooler (port 6543, DATABASE_URL) — see .env.supabase.
// Local dev only sets DATABASE_URL, so this falls back to it unchanged.
export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
});
