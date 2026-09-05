import { z } from "zod";

export const PLATFORMS = ["tiktok", "instagram", "youtube"] as const;
export const platformSchema = z.enum(PLATFORMS);
export type Platform = z.infer<typeof platformSchema>;

export const CAMPAIGN_STATUSES = [
  "draft",
  "active",
  "paused",
  "completed",
] as const;
export const campaignStatusSchema = z.enum(CAMPAIGN_STATUSES);
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;

export const SUBMISSION_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "paid",
] as const;
export const submissionStatusSchema = z.enum(SUBMISSION_STATUSES);
export type SubmissionStatus = z.infer<typeof submissionStatusSchema>;

export const USER_ROLES = ["admin", "creator"] as const;
export const userRoleSchema = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof userRoleSchema>;
