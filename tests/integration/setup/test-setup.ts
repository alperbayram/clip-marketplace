import { afterAll } from "vitest";
import { pgClient } from "@/server/db";

afterAll(async () => {
  await pgClient.end();
});
