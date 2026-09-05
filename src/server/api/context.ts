import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { readSessionCookie } from "@/server/auth/cookies";
import { verifySessionCookie } from "@/server/auth/session";

export type SessionUser = {
  id: string;
  email: string;
  role: "admin" | "creator";
};

export async function createContext() {
  const cookieValue = await readSessionCookie();
  const userId = verifySessionCookie(cookieValue);

  let user: SessionUser | null = null;
  if (userId) {
    const row = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (row) {
      user = { id: row.id, email: row.email, role: row.role };
    }
  }

  return { db, user };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
