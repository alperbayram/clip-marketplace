import { z } from "zod";
import { PLATFORMS, type Platform } from "./enums";

function hostMatches(hostname: string, root: string): boolean {
  const host = hostname.toLowerCase();
  return host === root || host.endsWith(`.${root}`);
}

export function urlMatchesPlatform(url: string, platform: Platform): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

  switch (platform) {
    case "tiktok":
      return (
        hostMatches(parsed.hostname, "tiktok.com") &&
        /\/@[^/]+\/video\/\d+/.test(parsed.pathname)
      );
    case "instagram":
      return (
        hostMatches(parsed.hostname, "instagram.com") &&
        /^\/(p|reel|tv)\/[A-Za-z0-9_-]+\/?$/.test(parsed.pathname)
      );
    case "youtube":
      if (hostMatches(parsed.hostname, "youtu.be")) {
        return /^\/[A-Za-z0-9_-]{6,}$/.test(parsed.pathname);
      }
      if (hostMatches(parsed.hostname, "youtube.com")) {
        return (
          (parsed.pathname === "/watch" && parsed.searchParams.has("v")) ||
          /^\/shorts\/[A-Za-z0-9_-]{6,}$/.test(parsed.pathname)
        );
      }
      return false;
  }
}

export function detectPlatformFromUrl(url: string): Platform | null {
  return PLATFORMS.find((platform) => urlMatchesPlatform(url, platform)) ?? null;
}

export const submissionCreateSchema = z.object({
  campaignId: z.uuid(),
  postUrl: z.url().max(2000),
});

export type SubmissionCreateValues = z.infer<typeof submissionCreateSchema>;

export const submissionApproveSchema = z.object({
  submissionId: z.uuid(),
});

export const submissionRejectSchema = z.object({
  submissionId: z.uuid(),
  reason: z.string().trim().min(1, "Rejection reason is required").max(1000),
});

export type SubmissionRejectValues = z.infer<typeof submissionRejectSchema>;

export const submissionMarkPaidSchema = z.object({
  submissionId: z.uuid(),
});
