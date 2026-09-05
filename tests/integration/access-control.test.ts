import { beforeEach, describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import type { SessionUser } from "@/server/api/context";
import {
  createCampaign,
  createSubmission,
  createUser,
  truncateAll,
} from "./setup/fixtures";

function callerAs(user: SessionUser | null) {
  return appRouter.createCaller({ db, user });
}

beforeEach(async () => {
  await truncateAll();
});

describe("access control", () => {
  it("scopes myList to the caller's own submissions, never another creator's", async () => {
    const creatorA = await createUser({ role: "creator" });
    const creatorB = await createUser({ role: "creator" });
    const campaign = await createCampaign();
    await createSubmission(campaign.id, creatorA.id, {
      postUrl: "https://www.tiktok.com/@a/video/1",
    });

    const asB = callerAs(creatorB as SessionUser);
    const listForB = await asB.submission.myList();
    expect(listForB).toHaveLength(0);

    const asA = callerAs(creatorA as SessionUser);
    const listForA = await asA.submission.myList();
    expect(listForA).toHaveLength(1);
  });

  it("does not let a creator approve a submission, even knowing its id", async () => {
    const creator = await createUser({ role: "creator" });
    const campaign = await createCampaign();
    const submission = await createSubmission(campaign.id, creator.id);

    const asCreator = callerAs(creator as SessionUser);
    await expect(
      asCreator.submission.approve({ submissionId: submission.id }),
    ).rejects.toBeInstanceOf(TRPCError);
    await expect(
      asCreator.submission.approve({ submissionId: submission.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("does not let a creator reach the admin review queue or campaign list", async () => {
    const creator = await createUser({ role: "creator" });
    const campaign = await createCampaign();
    const asCreator = callerAs(creator as SessionUser);

    await expect(
      asCreator.submission.reviewQueue({ campaignId: campaign.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      asCreator.campaign.adminList({ page: 1, pageSize: 10 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("does not let an admin submit a clip (creator-only procedure)", async () => {
    const admin = await createUser({ role: "admin" });
    const campaign = await createCampaign();
    const asAdmin = callerAs(admin as SessionUser);

    await expect(
      asAdmin.submission.create({
        campaignId: campaign.id,
        postUrl: "https://www.tiktok.com/@x/video/999",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects unauthenticated access to protected procedures", async () => {
    const anonymous = callerAs(null);
    await expect(anonymous.submission.myList()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("does not let a creator reject a submission — reject is admin-only regardless of ownership", async () => {
    const creatorA = await createUser({ role: "creator" });
    const campaign = await createCampaign();
    const submission = await createSubmission(campaign.id, creatorA.id);

    // Rejection is admin-only, so even the submission's own creator is
    // blocked at the role layer before any ownership check would run.
    const asCreatorA = callerAs(creatorA as SessionUser);
    await expect(
      asCreatorA.submission.reject({
        submissionId: submission.id,
        reason: "no",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
