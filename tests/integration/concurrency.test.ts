import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { submissions } from "@/server/db/schema";
import { approveSubmission } from "@/server/domain/approval";
import {
  addMetric,
  createCampaign,
  createSubmission,
  createUser,
  truncateAll,
} from "./setup/fixtures";

beforeEach(async () => {
  await truncateAll();
});

describe("concurrent approvals against a shared budget", () => {
  it("lets exactly one of two simultaneous approvals through when the budget only fits one", async () => {
    const creator = await createUser({ role: "creator" });
    // Budget covers one 1000-view submission (100) with 50 left over —
    // not an exact multiple, so whichever approval wins leaves the
    // campaign 'active' rather than auto-completing, isolating this test
    // to the BUDGET_EXCEEDED rejection path rather than CAMPAIGN_COMPLETED.
    const campaign = await createCampaign({
      payoutPerKViewsCents: 100,
      totalBudgetCents: 150,
    });

    const subA = await createSubmission(campaign.id, creator.id, {
      postUrl: "https://www.tiktok.com/@a/video/1",
    });
    const subB = await createSubmission(campaign.id, creator.id, {
      postUrl: "https://www.tiktok.com/@a/video/2",
    });
    await addMetric(subA.id, "2026-01-02", 1000);
    await addMetric(subB.id, "2026-01-02", 1000);

    // Fire both approvals at the same time as two genuinely separate
    // transactions (each db.transaction() call checks out its own
    // connection from the pool). The row lock on the campaign inside
    // approveSubmission should serialize them so only one succeeds.
    const results = await Promise.allSettled([
      approveSubmission(db, subA.id),
      approveSubmission(db, subB.id),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      cause: { appError: "BUDGET_EXCEEDED" },
    });

    const final = await db
      .select()
      .from(submissions)
      .where(eq(submissions.campaignId, campaign.id));
    const approvedCount = final.filter((s) => s.status === "approved").length;
    const pendingCount = final.filter((s) => s.status === "pending").length;
    expect(approvedCount).toBe(1);
    expect(pendingCount).toBe(1);
  });

  it("does not let concurrent approvals across different campaigns block each other", async () => {
    const creator = await createUser({ role: "creator" });
    const campaignA = await createCampaign({
      payoutPerKViewsCents: 100,
      totalBudgetCents: 1000,
    });
    const campaignB = await createCampaign({
      payoutPerKViewsCents: 100,
      totalBudgetCents: 1000,
    });
    const subA = await createSubmission(campaignA.id, creator.id);
    const subB = await createSubmission(campaignB.id, creator.id);
    await addMetric(subA.id, "2026-01-02", 1000);
    await addMetric(subB.id, "2026-01-02", 1000);

    const results = await Promise.allSettled([
      approveSubmission(db, subA.id),
      approveSubmission(db, subB.id),
    ]);

    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
  });
});
