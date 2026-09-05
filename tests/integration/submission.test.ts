import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import type { SessionUser } from "@/server/api/context";
import {
  createCampaign,
  createUser,
  truncateAll,
} from "./setup/fixtures";

function callerAs(user: SessionUser | null) {
  return appRouter.createCaller({ db, user });
}

beforeEach(async () => {
  await truncateAll();
});

describe("submission.create", () => {
  it("rejects a second submission of the same URL to the same campaign", async () => {
    const creator = await createUser({ role: "creator" });
    const campaign = await createCampaign({ platforms: ["tiktok"] });
    const asCreator = callerAs(creator as SessionUser);
    const postUrl = "https://www.tiktok.com/@a/video/1234567890123456789";

    await asCreator.submission.create({ campaignId: campaign.id, postUrl });

    await expect(
      asCreator.submission.create({ campaignId: campaign.id, postUrl }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      cause: { appError: "DUPLICATE_SUBMISSION" },
    });
  });

  it("rejects a URL for a platform the campaign doesn't accept", async () => {
    const creator = await createUser({ role: "creator" });
    const campaign = await createCampaign({ platforms: ["youtube"] });
    const asCreator = callerAs(creator as SessionUser);

    await expect(
      asCreator.submission.create({
        campaignId: campaign.id,
        postUrl: "https://www.tiktok.com/@a/video/1234567890123456789",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      cause: { appError: "PLATFORM_NOT_ALLOWED" },
    });
  });

  it("rejects a URL that doesn't look like a real post on any platform", async () => {
    const creator = await createUser({ role: "creator" });
    const campaign = await createCampaign({ platforms: ["tiktok"] });
    const asCreator = callerAs(creator as SessionUser);

    await expect(
      asCreator.submission.create({
        campaignId: campaign.id,
        postUrl: "https://example.com/not-a-clip",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      cause: { appError: "INVALID_SUBMISSION_URL" },
    });
  });

  it("rejects submissions to a non-active campaign", async () => {
    const creator = await createUser({ role: "creator" });
    const campaign = await createCampaign({ status: "draft" });
    const asCreator = callerAs(creator as SessionUser);

    await expect(
      asCreator.submission.create({
        campaignId: campaign.id,
        postUrl: "https://www.tiktok.com/@a/video/1234567890123456789",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("allows the same URL on two different campaigns", async () => {
    const creator = await createUser({ role: "creator" });
    const campaignA = await createCampaign({ platforms: ["tiktok"] });
    const campaignB = await createCampaign({ platforms: ["tiktok"] });
    const asCreator = callerAs(creator as SessionUser);
    const postUrl = "https://www.tiktok.com/@a/video/1234567890123456789";

    await asCreator.submission.create({ campaignId: campaignA.id, postUrl });
    const second = await asCreator.submission.create({
      campaignId: campaignB.id,
      postUrl,
    });
    expect(second.status).toBe("pending");
  });
});
