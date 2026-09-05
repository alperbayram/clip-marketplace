import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import * as relations from "./relations";

declare global {
  var __dbClient: postgres.Sql | undefined;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const isProduction = process.env.NODE_ENV === "production";

export const pgClient =
  global.__dbClient ??
  postgres(connectionString, {
    // 1 connection per serverless invocation in production: Supabase's
    // pooler (Supavisor) already pools connections in front of Postgres,
    // so stacking a larger client-side pool on top of it per-invocation
    // just multiplies connection count under concurrency.
    max: isProduction ? 1 : 5,
    // Required against Supabase's transaction-mode pooler (port 6543) —
    // pgbouncer in transaction mode doesn't support server-side prepared
    // statements. Harmless against a direct connection (e.g. local Docker
    // Postgres), so left on unconditionally.
    prepare: false,
  });

if (!isProduction) {
  global.__dbClient = pgClient;
}

export const db = drizzle(pgClient, { schema: { ...schema, ...relations } });

export type DbClient = typeof db;
export type DbTransaction = Parameters<
  Parameters<DbClient["transaction"]>[0]
>[0];
export type Db = DbClient | DbTransaction;
