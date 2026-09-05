import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { DbClient } from "@/server/db";
import { campaigns, submissions } from "@/server/db/schema";
import { getLatestViewsBySubmissionId } from "./metrics";
import { computeEarningsCents } from "./payout";
import { computeApprovedSpendCents } from "./spend";

/**
 * Approves a pending submission, enforcing the campaign budget ceiling.
 *
 * Concurrency: locks the campaign row with SELECT ... FOR UPDATE for the
 * duration of the transaction. This serializes every approval attempt
 * against the *same* campaign, so two admins racing to approve against a
 * budget that only fits one of them will have the second one see the first
 * one's committed spend before it decides. A bare atomic UPDATE...WHERE
 * would not catch this: under READ COMMITTED, two approvals hitting
 * *different* submission rows don't lock each other and can both read the
 * same stale "spend so far" snapshot. See NOTES.md for the full comparison
 * against optimistic locking and SERIALIZABLE + retry.
 */
export async function approveSubmission(db: DbClient, submissionId: string) {
  return db.transaction(async (tx) => {
    const submission = await tx.query.submissions.findFirst({
      where: eq(submissions.id, submissionId),
    });
    if (!submission) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }
    if (submission.status !== "pending") {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Submission is already ${submission.status}`,
      });
    }

    const [campaign] = await tx
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, submission.campaignId))
      .for("update");

    if (!campaign) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }
    if (campaign.status === "completed") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Campaign is already completed",
        cause: { appError: "CAMPAIGN_COMPLETED" },
      });
    }

    const spentSoFarCents = await computeApprovedSpendCents(
      tx,
      campaign.id,
      campaign.payoutPerKViewsCents,
    );

    const latestViews = await getLatestViewsBySubmissionId(tx, [submission.id]);
    const candidateEarningsCents = computeEarningsCents(
      latestViews.get(submission.id) ?? 0,
      campaign.payoutPerKViewsCents,
    );

    const projectedSpendCents = spentSoFarCents + candidateEarningsCents;

    if (projectedSpendCents > campaign.totalBudgetCents) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Approving this submission would exceed the campaign budget",
        cause: {
          appError: "BUDGET_EXCEEDED",
          remainingCents: campaign.totalBudgetCents - spentSoFarCents,
        },
      });
    }

    const [updated] = await tx
      .update(submissions)
      .set({ status: "approved" })
      .where(eq(submissions.id, submission.id))
      .returning();

    if (projectedSpendCents >= campaign.totalBudgetCents) {
      await tx
        .update(campaigns)
        .set({ status: "completed" })
        .where(eq(campaigns.id, campaign.id));
    }

    return updated;
  });
}
