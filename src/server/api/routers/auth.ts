import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { users } from "@/server/db/schema";
import { setSessionCookie, clearSessionCookie } from "@/server/auth/cookies";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const authRouter = createTRPCRouter({
  me: publicProcedure.query(({ ctx }) => ctx.user),

  listUsers: publicProcedure.query(({ ctx }) =>
    ctx.db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .orderBy(users.email),
  ),

  switchUser: publicProcedure
    .input(z.object({ userId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.id, input.userId),
      });
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await setSessionCookie(user.id);
      return { id: user.id, email: user.email, role: user.role };
    }),

  logout: publicProcedure.mutation(async () => {
    await clearSessionCookie();
    return { ok: true };
  }),
});
