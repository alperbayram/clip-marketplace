import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";

export type AppErrorCode =
  | "BUDGET_EXCEEDED"
  | "CAMPAIGN_COMPLETED"
  | "DUPLICATE_SUBMISSION"
  | "PLATFORM_NOT_ALLOWED"
  | "INVALID_SUBMISSION_URL";

export type AppErrorCause = { appError: AppErrorCode; [key: string]: unknown };

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const cause = error.cause as Partial<AppErrorCause> | undefined;
    return {
      ...shape,
      data: {
        ...shape.data,
        appErrorCode: cause?.appError,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

export const creatorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "creator") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});
