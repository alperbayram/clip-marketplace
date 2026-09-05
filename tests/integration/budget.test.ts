import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { campaigns, submissions } from "@/server/db/schema";
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

describe("budget ceiling", () => {
  it("approves submissions while budget remains, then rejects one that would exceed it", async () => {
    const creator = await createUser({ role: "creator" });
    // payout 100 cents / 1k views; budget fits two 1000-view submissions
    // (200) with 50 left over — not an exact multiple, so the campaign
    // stays active after B and C is rejected for budget, not completion.
    const campaign = await createCampaign({
      payoutPerKViewsCents: 100,
      totalBudgetCents: 250,
    });

    const subA = await createSubmission(campaign.id, creator.id, {
      postUrl: "https://www.tiktok.com/@a/video/1",
    });
    const subB = await createSubmission(campaign.id, creator.id, {
      postUrl: "https://www.tiktok.com/@a/video/2",
    });
    const subC = await createSubmission(campaign.id, creator.id, {
      postUrl: "https://www.tiktok.com/@a/video/3",
    });

    await addMetric(subA.id, "2026-01-02", 1000);
    await addMetric(subB.id, "2026-01-02", 1000);
    await addMetric(subC.id, "2026-01-02", 1000);

    await approveSubmission(db, subA.id);
    await approveSubmission(db, subB.id);

    const campaignAfterB = await db.query.campaigns.findFirst({
      where: eq(campaigns.id, campaign.id),
    });
    expect(campaignAfterB?.status).toBe("active");

    await expect(approveSubmission(db, subC.id)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      cause: { appError: "BUDGET_EXCEEDED" },
    });

    const finalC = await db.query.submissions.findFirst({
      where: eq(submissions.id, subC.id),
    });
    expect(finalC?.status).toBe("pending");
  });

  it("auto-completes the campaign once the budget is fully spent", async () => {
    const creator = await createUser({ role: "creator" });
    const campaign = await createCampaign({
      payoutPerKViewsCents: 100,
      totalBudgetCents: 100,
    });
    const sub = await createSubmission(campaign.id, creator.id);
    await addMetric(sub.id, "2026-01-02", 1000);

    await approveSubmission(db, sub.id);

    const updatedCampaign = await db.query.campaigns.findFirst({
      where: eq(campaigns.id, campaign.id),
    });
    expect(updatedCampaign?.status).toBe("completed");
  });

  it("does not approve into an already-completed campaign", async () => {
    const creator = await createUser({ role: "creator" });
    const campaign = await createCampaign({ status: "completed" });
    const sub = await createSubmission(campaign.id, creator.id);

    await expect(approveSubmission(db, sub.id)).rejects.toMatchObject({
      cause: { appError: "CAMPAIGN_COMPLETED" },
    });
  });

  it("uses the most recent metric row when computing earnings", async () => {
    const creator = await createUser({ role: "creator" });
    const campaign = await createCampaign({
      payoutPerKViewsCents: 100,
      totalBudgetCents: 1000,
    });
    const sub = await createSubmission(campaign.id, creator.id);
    await addMetric(sub.id, "2026-01-01", 500); // below threshold
    await addMetric(sub.id, "2026-01-03", 2500); // most recent, should be used
    await addMetric(sub.id, "2026-01-02", 1000); // out of order insert, still older

    const approved = await approveSubmission(db, sub.id);
    expect(approved.status).toBe("approved");

    // spend should reflect floor(2500/1000)*100 = 200, not the 1000 or 500 rows
    const campaignAfter = await db.query.campaigns.findFirst({
      where: eq(campaigns.id, campaign.id),
    });
    expect(campaignAfter?.status).toBe("active"); // 200 < 1000 budget, not exhausted
  });
});
