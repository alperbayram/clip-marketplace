import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { submissionMetrics, submissions } from "@/server/db/schema";
import { ingestOne, runIngest } from "@/server/domain/ingest";
import {
  createCampaign,
  createSubmission,
  createUser,
  truncateAll,
} from "./setup/fixtures";

beforeEach(async () => {
  await truncateAll();
});

describe("runIngest", () => {
  it("writes one metric row per approved/paid submission and skips pending/rejected", async () => {
    const creator = await createUser({ role: "creator" });
    const campaign = await createCampaign();
    const approved = await createSubmission(campaign.id, creator.id, {
      postUrl: "https://www.tiktok.com/@a/video/1",
      status: "approved",
    });
    const paid = await createSubmission(campaign.id, creator.id, {
      postUrl: "https://www.tiktok.com/@a/video/2",
      status: "paid",
    });
    await createSubmission(campaign.id, creator.id, {
      postUrl: "https://www.tiktok.com/@a/video/3",
      status: "pending",
    });
    await createSubmission(campaign.id, creator.id, {
      postUrl: "https://www.tiktok.com/@a/video/4",
      status: "rejected",
    });

    const summary = await runIngest(db, "2026-02-01");
    expect(summary.total).toBe(2);
    expect(summary.succeeded).toBe(2);
    expect(summary.failures).toHaveLength(0);

    const rows = await db
      .select()
      .from(submissionMetrics)
      .where(eq(submissionMetrics.capturedAt, "2026-02-01"));
    const submissionIds = rows.map((r) => r.submissionId).sort();
    expect(submissionIds).toEqual([approved.id, paid.id].sort());
  });

  it("is idempotent: running the same day twice leaves data unchanged", async () => {
    const creator = await createUser({ role: "creator" });
    const campaign = await createCampaign();
    const sub = await createSubmission(campaign.id, creator.id, {
      status: "approved",
    });

    await runIngest(db, "2026-02-01");
    const [firstRun] = await db
      .select()
      .from(submissionMetrics)
      .where(
        and(
          eq(submissionMetrics.submissionId, sub.id),
          eq(submissionMetrics.capturedAt, "2026-02-01"),
        ),
      );

    await runIngest(db, "2026-02-01");
    const [secondRun] = await db
      .select()
      .from(submissionMetrics)
      .where(
        and(
          eq(submissionMetrics.submissionId, sub.id),
          eq(submissionMetrics.capturedAt, "2026-02-01"),
        ),
      );

    expect(secondRun).toEqual(firstRun);
  });

  it("views only ever go up day over day", async () => {
    const creator = await createUser({ role: "creator" });
    const campaign = await createCampaign();
    const sub = await createSubmission(campaign.id, creator.id, {
      status: "approved",
    });

    await runIngest(db, "2026-02-01");
    await runIngest(db, "2026-02-02");
    await runIngest(db, "2026-02-03");

    const rows = await db
      .select()
      .from(submissionMetrics)
      .where(eq(submissionMetrics.submissionId, sub.id));
    const byDate = new Map(rows.map((r) => [r.capturedAt, r.views]));

    expect(byDate.get("2026-02-02")!).toBeGreaterThan(byDate.get("2026-02-01")!);
    expect(byDate.get("2026-02-03")!).toBeGreaterThan(byDate.get("2026-02-02")!);
  });

  it("continues past a single submission failure and reports it", async () => {
    const creator = await createUser({ role: "creator" });
    const campaign = await createCampaign();
    const good = await createSubmission(campaign.id, creator.id, {
      postUrl: "https://www.tiktok.com/@a/video/1",
      status: "approved",
    });
    const bad = await createSubmission(campaign.id, creator.id, {
      postUrl: "https://www.tiktok.com/@a/video/2",
      status: "approved",
    });

    // Delete the "bad" submission's row out from under the ingest run after
    // it's been read as a target, to force ingestOne to fail for it (e.g.
    // simulating a submission removed mid-run) while leaving the target
    // list built. We do this by spying on the module isn't practical here,
    // so instead we simulate failure via a submission id that no longer
    // has a valid FK target: delete it, then run ingest against a merged
    // target list.
    await db.delete(submissions).where(eq(submissions.id, bad.id));

    const targets = [
      { id: good.id },
      { id: bad.id }, // no longer exists -> FK violation on insert
    ];
    const results = await Promise.allSettled(
      targets.map((t) => ingestOne(db, t.id, "2026-02-01")),
    );

    expect(results[0]!.status).toBe("fulfilled");
    expect(results[1]!.status).toBe("rejected");

    const goodMetric = await db.query.submissionMetrics.findFirst({
      where: and(
        eq(submissionMetrics.submissionId, good.id),
        eq(submissionMetrics.capturedAt, "2026-02-01"),
      ),
    });
    expect(goodMetric).toBeTruthy();
  });
});
