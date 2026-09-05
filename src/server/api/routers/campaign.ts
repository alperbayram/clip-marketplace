import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { campaigns, submissions } from "@/server/db/schema";
import {
  campaignCreateSchema,
  campaignUpdateSchema,
} from "@/shared/validators/campaign";
import { campaignListQuerySchema } from "@/shared/validators/pagination";
import { getLatestViewsBySubmissionId } from "@/server/domain/metrics";
import { computeEarningsCents } from "@/server/domain/payout";
import { adminProcedure, createTRPCRouter, publicProcedure } from "../trpc";

export const campaignRouter = createTRPCRouter({
  adminList: adminProcedure
    .input(campaignListQuerySchema)
    .query(async ({ ctx, input }) => {
      const conditions = [
        input.search
          ? ilike(campaigns.title, `%${input.search}%`)
          : undefined,
        input.status ? eq(campaigns.status, input.status) : undefined,
      ].filter((c): c is NonNullable<typeof c> => c !== undefined);
      const where = conditions.length ? and(...conditions) : undefined;

      const [items, totalRows] = await Promise.all([
        ctx.db
          .select()
          .from(campaigns)
          .where(where)
          .orderBy(desc(campaigns.createdAt))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(campaigns)
          .where(where),
      ]);

      return {
        items,
        total: totalRows[0]?.count ?? 0,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  browseActive: publicProcedure.query(({ ctx }) =>
    ctx.db
      .select()
      .from(campaigns)
      .where(eq(campaigns.status, "active"))
      .orderBy(desc(campaigns.createdAt)),
  ),

  getById: adminProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const campaign = await ctx.db.query.campaigns.findFirst({
        where: eq(campaigns.id, input.id),
      });
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });
      return campaign;
    }),

  getActiveById: publicProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const campaign = await ctx.db.query.campaigns.findFirst({
        where: and(eq(campaigns.id, input.id), eq(campaigns.status, "active")),
      });
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });
      return campaign;
    }),

  create: adminProcedure
    .input(campaignCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const [campaign] = await ctx.db
        .insert(campaigns)
        .values(input)
        .returning();
      return campaign;
    }),

  update: adminProcedure
    .input(campaignUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const [campaign] = await ctx.db
        .update(campaigns)
        .set(input.data)
        .where(eq(campaigns.id, input.id))
        .returning();
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });
      return campaign;
    }),

  overview: adminProcedure
    .input(z.object({ campaignId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const campaign = await ctx.db.query.campaigns.findFirst({
        where: eq(campaigns.id, input.campaignId),
      });
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });

      const approvedOrPaid = await ctx.db
        .select({ id: submissions.id })
        .from(submissions)
        .where(
          and(
            eq(submissions.campaignId, campaign.id),
            inArray(submissions.status, ["approved", "paid"]),
          ),
        );

      const latestViews = await getLatestViewsBySubmissionId(
        ctx.db,
        approvedOrPaid.map((s) => s.id),
      );

      const totalApprovedViews = [...latestViews.values()].reduce(
        (sum, v) => sum + v,
        0,
      );
      const budgetSpentCents = approvedOrPaid.reduce(
        (sum, s) =>
          sum +
          computeEarningsCents(
            latestViews.get(s.id) ?? 0,
            campaign.payoutPerKViewsCents,
          ),
        0,
      );
      const budgetLeftCents = Math.max(
        campaign.totalBudgetCents - budgetSpentCents,
        0,
      );

      const dailySeriesResult = await ctx.db.execute<{
        day: string;
        views: number;
      }>(sql`
        SELECT to_char(d, 'YYYY-MM-DD') AS day, COALESCE(SUM(m.views), 0)::int AS views
        FROM generate_series(${campaign.startsAt}::date, ${campaign.endsAt}::date, interval '1 day') d
        LEFT JOIN submissions s ON s.campaign_id = ${campaign.id}
        LEFT JOIN submission_metrics m ON m.submission_id = s.id AND m.captured_at = d::date
        GROUP BY d
        ORDER BY d
      `);

      return {
        campaign,
        totalApprovedViews,
        budgetSpentCents,
        budgetLeftCents,
        isOverBudget: budgetSpentCents > campaign.totalBudgetCents,
        dailySeries: [...dailySeriesResult].map((row) => ({
          day: row.day,
          views: row.views,
        })),
      };
    }),
});
