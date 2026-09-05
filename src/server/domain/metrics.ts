import { desc, inArray } from "drizzle-orm";
import type { Db } from "@/server/db";
import { submissionMetrics } from "@/server/db/schema";

/**
 * Most recent submission_metrics.views per submission id. Relies on ordering
 * by capturedAt desc and keeping only the first (latest) row seen per id,
 * since submission_metrics has no separate surrogate id to ORDER BY.
 */
export async function getLatestViewsBySubmissionId(
  db: Db,
  submissionIds: string[],
): Promise<Map<string, number>> {
  if (submissionIds.length === 0) return new Map();

  const rows = await db
    .select({
      submissionId: submissionMetrics.submissionId,
      views: submissionMetrics.views,
    })
    .from(submissionMetrics)
    .where(inArray(submissionMetrics.submissionId, submissionIds))
    .orderBy(desc(submissionMetrics.capturedAt));

  const result = new Map<string, number>();
  for (const row of rows) {
    if (!result.has(row.submissionId)) {
      result.set(row.submissionId, row.views);
    }
  }
  return result;
}
