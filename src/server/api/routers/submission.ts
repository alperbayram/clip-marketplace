import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { campaigns, submissions } from "@/server/db/schema";
import {
  detectPlatformFromUrl,
  submissionApproveSchema,
  submissionCreateSchema,
  submissionMarkPaidSchema,
  submissionRejectSchema,
} from "@/shared/validators/submission";
import { z } from "zod";
import { approveSubmission } from "@/server/domain/approval";
import { getLatestViewsBySubmissionId } from "@/server/domain/metrics";
import { computeEarningsCents } from "@/server/domain/payout";
import {
  adminProcedure,
  createTRPCRouter,
  creatorProcedure,
} from "../trpc";

function getPgErrorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string") return code;
  // drizzle-orm wraps the raw postgres.js error in a DrizzleQueryError,
  // putting the original error (with its `code`) on `.cause`.
  if ("cause" in err) return getPgErrorCode((err as { cause?: unknown }).cause);
  return undefined;
}

function isUniqueViolation(err: unknown): boolean {
  return getPgErrorCode(err) === "23505";
}

export const submissionRouter = createTRPCRouter({
  create: creatorProcedure
    .input(submissionCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.db.query.campaigns.findFirst({
        where: and(
          eq(campaigns.id, input.campaignId),
          eq(campaigns.status, "active"),
        ),
      });
      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const platform = detectPlatformFromUrl(input.postUrl);
      if (!platform) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "URL does not look like a real post URL on a supported platform",
          cause: { appError: "INVALID_SUBMISSION_URL" },
        });
      }
      if (!campaign.platforms.includes(platform)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `This campaign does not accept ${platform} submissions`,
          cause: { appError: "PLATFORM_NOT_ALLOWED" },
        });
      }

      try {
        const [submission] = await ctx.db
          .insert(submissions)
          .values({
            campaignId: campaign.id,
            creatorId: ctx.user.id,
            postUrl: input.postUrl,
            platform,
          })
          .returning();
        return submission;
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This URL has already been submitted to this campaign",
            cause: { appError: "DUPLICATE_SUBMISSION" },
          });
        }
        throw err;
      }
    }),

  myList: creatorProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        submission: submissions,
        payoutPerKViewsCents: campaigns.payoutPerKViewsCents,
        campaignTitle: campaigns.title,
      })
      .from(submissions)
      .innerJoin(campaigns, eq(submissions.campaignId, campaigns.id))
      .where(eq(submissions.creatorId, ctx.user.id))
      .orderBy(desc(submissions.createdAt));

    const latestViews = await getLatestViewsBySubmissionId(
      ctx.db,
      rows.map((r) => r.submission.id),
    );

    return rows.map((r) => {
      const views = latestViews.get(r.submission.id) ?? 0;
      return {
        ...r.submission,
        campaignTitle: r.campaignTitle,
        currentViews: views,
        estimatedEarningsCents: computeEarningsCents(
          views,
          r.payoutPerKViewsCents,
        ),
      };
    });
  }),

  reviewQueue: adminProcedure
    .input(z.object({ campaignId: z.uuid() }))
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(submissions)
        .where(
          and(
            eq(submissions.campaignId, input.campaignId),
            eq(submissions.status, "pending"),
          ),
        )
        .orderBy(submissions.createdAt),
    ),

  approvedList: adminProcedure
    .input(z.object({ campaignId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const campaign = await ctx.db.query.campaigns.findFirst({
        where: eq(campaigns.id, input.campaignId),
      });
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });

      const rows = await ctx.db
        .select()
        .from(submissions)
        .where(
          and(
            eq(submissions.campaignId, input.campaignId),
            inArray(submissions.status, ["approved", "paid"]),
          ),
        )
        .orderBy(desc(submissions.updatedAt));

      const latestViews = await getLatestViewsBySubmissionId(
        ctx.db,
        rows.map((r) => r.id),
      );

      return rows.map((r) => {
        const views = latestViews.get(r.id) ?? 0;
        return {
          ...r,
          currentViews: views,
          estimatedEarningsCents: computeEarningsCents(
            views,
            campaign.payoutPerKViewsCents,
          ),
        };
      });
    }),

  approve: adminProcedure
    .input(submissionApproveSchema)
    .mutation(({ ctx, input }) =>
      approveSubmission(ctx.db, input.submissionId),
    ),

  reject: adminProcedure
    .input(submissionRejectSchema)
    .mutation(async ({ ctx, input }) => {
      const submission = await ctx.db.query.submissions.findFirst({
        where: eq(submissions.id, input.submissionId),
      });
      if (!submission) throw new TRPCError({ code: "NOT_FOUND" });
      if (submission.status !== "pending") {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Submission is already ${submission.status}`,
        });
      }

      const [updated] = await ctx.db
        .update(submissions)
        .set({ status: "rejected", rejectionReason: input.reason })
        .where(eq(submissions.id, input.submissionId))
        .returning();
      return updated;
    }),

  markPaid: adminProcedure
    .input(submissionMarkPaidSchema)
    .mutation(async ({ ctx, input }) => {
      const submission = await ctx.db.query.submissions.findFirst({
        where: eq(submissions.id, input.submissionId),
      });
      if (!submission) throw new TRPCError({ code: "NOT_FOUND" });
      if (submission.status !== "approved") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Only approved submissions can be marked as paid",
        });
      }

      const [updated] = await ctx.db
        .update(submissions)
        .set({ status: "paid" })
        .where(eq(submissions.id, input.submissionId))
        .returning();
      return updated;
    }),
});
