import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  campaigns,
  submissionMetrics,
  submissions,
  users,
} from "@/server/db/schema";
import type { Platform } from "@/shared/validators/enums";

export async function truncateAll(): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE submission_metrics, submissions, campaigns, users RESTART IDENTITY CASCADE`,
  );
}

export async function createUser(overrides: {
  email?: string;
  role?: "admin" | "creator";
} = {}) {
  const [user] = await db
    .insert(users)
    .values({
      email: overrides.email ?? `user-${randomUUID()}@test.dev`,
      role: overrides.role ?? "creator",
    })
    .returning();
  return user!;
}

export async function createCampaign(overrides: {
  title?: string;
  platforms?: Platform[];
  payoutPerKViewsCents?: number;
  totalBudgetCents?: number;
  status?: "draft" | "active" | "paused" | "completed";
  startsAt?: string;
  endsAt?: string;
} = {}) {
  const [campaign] = await db
    .insert(campaigns)
    .values({
      title: overrides.title ?? "Test Campaign",
      platforms: overrides.platforms ?? ["tiktok"],
      payoutPerKViewsCents: overrides.payoutPerKViewsCents ?? 100,
      totalBudgetCents: overrides.totalBudgetCents ?? 100_000,
      status: overrides.status ?? "active",
      startsAt: overrides.startsAt ?? "2026-01-01",
      endsAt: overrides.endsAt ?? "2026-01-31",
    })
    .returning();
  return campaign!;
}

export async function createSubmission(
  campaignId: string,
  creatorId: string,
  overrides: {
    postUrl?: string;
    platform?: Platform;
    status?: "pending" | "approved" | "rejected" | "paid";
  } = {},
) {
  const [submission] = await db
    .insert(submissions)
    .values({
      campaignId,
      creatorId,
      postUrl:
        overrides.postUrl ??
        `https://www.tiktok.com/@user/video/${Date.now()}${Math.floor(Math.random() * 100000)}`,
      platform: overrides.platform ?? "tiktok",
      status: overrides.status ?? "pending",
    })
    .returning();
  return submission!;
}

export async function addMetric(
  submissionId: string,
  capturedAt: string,
  views: number,
  likes = 0,
  comments = 0,
) {
  await db
    .insert(submissionMetrics)
    .values({ submissionId, capturedAt, views, likes, comments });
}
