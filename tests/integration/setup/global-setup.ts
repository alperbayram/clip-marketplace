import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

export default async function setup() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — is .env loaded?");
  }

  const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await sql.end();
}
