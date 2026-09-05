import { describe, expect, it } from "vitest";
import { campaignFormSchema } from "@/shared/validators/campaign";
import {
  detectPlatformFromUrl,
  submissionRejectSchema,
  urlMatchesPlatform,
} from "@/shared/validators/submission";

const validCampaign = {
  title: "Launch Clips",
  platforms: ["tiktok"] as const,
  payoutPerKViewsCents: 100,
  totalBudgetCents: 100_000,
  status: "active" as const,
  startsAt: "2026-01-01",
  endsAt: "2026-01-31",
};

describe("campaignFormSchema", () => {
  it("accepts a valid campaign", () => {
    expect(campaignFormSchema.safeParse(validCampaign).success).toBe(true);
  });

  it("rejects endsAt on or before startsAt", () => {
    const result = campaignFormSchema.safeParse({
      ...validCampaign,
      startsAt: "2026-02-01",
      endsAt: "2026-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive budget", () => {
    const result = campaignFormSchema.safeParse({
      ...validCampaign,
      totalBudgetCents: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty platforms list", () => {
    const result = campaignFormSchema.safeParse({
      ...validCampaign,
      platforms: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("submissionRejectSchema", () => {
  it("requires a non-empty rejection reason", () => {
    const result = submissionRejectSchema.safeParse({
      submissionId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      reason: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a real reason", () => {
    const result = submissionRejectSchema.safeParse({
      submissionId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      reason: "Low quality clip",
    });
    expect(result.success).toBe(true);
  });
});

describe("urlMatchesPlatform / detectPlatformFromUrl", () => {
  it("matches a real tiktok video URL", () => {
    expect(
      urlMatchesPlatform(
        "https://www.tiktok.com/@someuser/video/7123456789012345678",
        "tiktok",
      ),
    ).toBe(true);
  });

  it("matches a real instagram reel URL", () => {
    expect(
      urlMatchesPlatform("https://www.instagram.com/reel/Cabc123XYZ/", "instagram"),
    ).toBe(true);
  });

  it("matches a youtube watch URL and a youtu.be short link", () => {
    expect(
      urlMatchesPlatform("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube"),
    ).toBe(true);
    expect(urlMatchesPlatform("https://youtu.be/dQw4w9WgXcQ", "youtube")).toBe(
      true,
    );
  });

  it("rejects a URL from an unrelated site", () => {
    expect(urlMatchesPlatform("https://example.com/not-a-clip", "tiktok")).toBe(
      false,
    );
  });

  it("rejects a platform's homepage without a post path", () => {
    expect(urlMatchesPlatform("https://www.tiktok.com/", "tiktok")).toBe(false);
  });

  it("detects the platform from a bare URL", () => {
    expect(
      detectPlatformFromUrl("https://www.instagram.com/p/Cabc123XYZ/"),
    ).toBe("instagram");
    expect(detectPlatformFromUrl("https://example.com/nope")).toBeNull();
  });
});
