import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/server/db";
import { submissions } from "@/server/db/schema";
import { getLatestViewsBySubmissionId } from "./metrics";
import { computeEarningsCents } from "./payout";

/**
 * Total cents already committed against a campaign's budget: the sum of
 * current (view-based) earnings across every 'approved' or 'paid'
 * submission. This is recomputed on demand rather than cached, since a
 * submission's earnings grow as new metrics are ingested.
 */
export async function computeApprovedSpendCents(
  db: Db,
  campaignId: string,
  payoutPerKViewsCents: number,
): Promise<number> {
  const approvedOrPaid = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(
      and(
        eq(submissions.campaignId, campaignId),
        inArray(submissions.status, ["approved", "paid"]),
      ),
    );

  if (approvedOrPaid.length === 0) return 0;

  const latestViews = await getLatestViewsBySubmissionId(
    db,
    approvedOrPaid.map((s) => s.id),
  );

  return approvedOrPaid.reduce(
    (sum, s) =>
      sum + computeEarningsCents(latestViews.get(s.id) ?? 0, payoutPerKViewsCents),
    0,
  );
}
