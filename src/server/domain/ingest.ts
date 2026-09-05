import { createHash } from "node:crypto";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import type { DbClient } from "@/server/db";
import { campaigns, submissionMetrics, submissions } from "@/server/db/schema";
import { computeApprovedSpendCents } from "./spend";

export function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Deterministic "fake" daily view increment, seeded by (submissionId, date).
 * Must be deterministic (not Math.random()) so re-running ingest for the
 * same day recomputes the exact same value and the upsert below is a true
 * no-op on rerun.
 */
export function seededIncrement(submissionId: string, dateStr: string): number {
  const hash = createHash("sha256")
    .update(`${submissionId}:${dateStr}`)
    .digest();
  const seed = hash.readUInt32BE(0);
  // 50 - 950 new views/day, deterministic per (submission, day)
  return 50 + (seed % 901);
}

function seededEngagement(views: number, submissionId: string, dateStr: string) {
  const hash = createHash("sha256")
    .update(`${submissionId}:${dateStr}:engagement`)
    .digest();
  const likeRate = 0.02 + (hash.readUInt32BE(0) % 100) / 5000; // ~2-4%
  const commentRate = 0.002 + (hash.readUInt32BE(4) % 100) / 50000; // ~0.2-0.4%
  return {
    likes: Math.round(views * likeRate),
    comments: Math.round(views * commentRate),
  };
}

export async function ingestOne(
  db: DbClient,
  submissionId: string,
  dateStr: string,
): Promise<void> {
  const previous = await db.query.submissionMetrics.findFirst({
    where: and(
      eq(submissionMetrics.submissionId, submissionId),
      lt(submissionMetrics.capturedAt, dateStr),
    ),
    orderBy: desc(submissionMetrics.capturedAt),
  });

  const prevViews = previous?.views ?? 0;
  const increment = seededIncrement(submissionId, dateStr);
  const views = prevViews + increment;
  const { likes, comments } = seededEngagement(views, submissionId, dateStr);

  await db
    .insert(submissionMetrics)
    .values({ submissionId, capturedAt: dateStr, views, likes, comments })
    .onConflictDoUpdate({
      target: [submissionMetrics.submissionId, submissionMetrics.capturedAt],
      set: { views, likes, comments },
    });
}

async function autoCompleteExhaustedCampaigns(
  db: DbClient,
  campaignIds: Set<string>,
) {
  const completed: string[] = [];
  for (const campaignId of campaignIds) {
    const campaign = await db.query.campaigns.findFirst({
      where: eq(campaigns.id, campaignId),
    });
    if (!campaign || campaign.status === "completed") continue;

    const spentCents = await computeApprovedSpendCents(
      db,
      campaign.id,
      campaign.payoutPerKViewsCents,
    );
    if (spentCents >= campaign.totalBudgetCents) {
      await db
        .update(campaigns)
        .set({ status: "completed" })
        .where(eq(campaigns.id, campaign.id));
      completed.push(campaign.id);
    }
  }
  return completed;
}

export type IngestFailure = { submissionId: string; reason: string };

export type IngestSummary = {
  dateStr: string;
  total: number;
  succeeded: number;
  failures: IngestFailure[];
  autoCompletedCampaignIds: string[];
};

/**
 * Runs one daily metrics sync: one submission_metrics row per approved (or
 * paid) submission, views monotonically increasing, idempotent per day.
 * A failure ingesting one submission never aborts the others (Promise.allSettled,
 * per-item try/catch) — all failures are collected and returned instead.
 */
export async function runIngest(
  db: DbClient,
  dateStr: string = todayISODate(),
): Promise<IngestSummary> {
  const targets = await db
    .select({ id: submissions.id, campaignId: submissions.campaignId })
    .from(submissions)
    .where(inArray(submissions.status, ["approved", "paid"]));

  const results = await Promise.allSettled(
    targets.map((t) => ingestOne(db, t.id, dateStr)),
  );

  const failures: IngestFailure[] = [];
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      failures.push({
        submissionId: targets[i]!.id,
        reason:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      });
    }
  });

  const autoCompletedCampaignIds = await autoCompleteExhaustedCampaigns(
    db,
    new Set(targets.map((t) => t.campaignId)),
  );

  return {
    dateStr,
    total: targets.length,
    succeeded: targets.length - failures.length,
    failures,
    autoCompletedCampaignIds,
  };
}
