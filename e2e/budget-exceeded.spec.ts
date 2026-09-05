import { test, expect } from "@playwright/test";
import { eq } from "drizzle-orm";
import { db } from "../src/server/db";
import { submissionMetrics, submissions } from "../src/server/db/schema";
import { switchUser, uniquePostUrl, uniqueTitle } from "./fixtures";

async function seedViews(postUrl: string, views: number) {
  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.postUrl, postUrl),
  });
  if (!submission) throw new Error(`submission not found for ${postUrl}`);
  await db.insert(submissionMetrics).values({
    submissionId: submission.id,
    capturedAt: new Date().toISOString().slice(0, 10),
    views,
  });
}

test("approving a submission that would exceed the budget surfaces a typed error in the UI", async ({
  page,
}) => {
  await page.goto("/");
  await switchUser(page, "admin@");

  await page.goto("/admin/campaigns/new");
  const title = uniqueTitle("Budget Exceeded Campaign");
  await page.getByLabel("Title").fill(title);
  await page.getByRole("checkbox", { name: "tiktok" }).click();
  await page.getByLabel("Payout per 1,000 views (cents)").fill("100");
  // Budget fits exactly one 1000-view submission (100 cents), not two.
  await page.getByLabel("Total budget (cents)").fill("150");
  await page.getByLabel("Starts at").fill("2026-01-01");
  await page.getByLabel("Ends at").fill("2026-12-31");
  await page.getByRole("combobox", { name: "Status" }).click();
  await page.getByRole("option", { name: "active" }).click();
  await page.getByRole("button", { name: "Create campaign" }).click();
  await expect(page).toHaveURL(/\/admin\/campaigns\/[0-9a-f-]+$/);
  const campaignUrl = page.url();

  await switchUser(page, "alice@");
  await page.goto(campaignUrl.replace("/admin", ""));

  const urlA = uniquePostUrl();
  await page.getByLabel("Post URL").fill(urlA);
  await page.getByRole("button", { name: "Submit clip" }).click();
  await expect(page.getByText("Clip submitted for review")).toBeVisible();

  const urlB = uniquePostUrl();
  await page.getByLabel("Post URL").fill(urlB);
  await page.getByRole("button", { name: "Submit clip" }).click();

  // Directly seed 1000 views on each submission (earnings = 100 cents each)
  // rather than depending on `pnpm ingest`'s pseudo-random daily increments,
  // so the budget boundary in this test is exact and deterministic.
  await seedViews(urlA, 1000);
  await seedViews(urlB, 1000);

  await switchUser(page, "admin@");
  await page.goto(campaignUrl);

  await page
    .getByRole("row", { name: new RegExp(urlA) })
    .getByRole("button", { name: "Approve" })
    .click();
  await expect(page.getByText("Submission approved")).toBeVisible();

  await page
    .getByRole("row", { name: new RegExp(urlB) })
    .getByRole("button", { name: "Approve" })
    .click();
  await expect(
    page.getByText("Approving this would exceed the campaign budget."),
  ).toBeVisible();

  // The second submission stays pending in the review queue.
  await expect(page.getByRole("row", { name: new RegExp(urlB) })).toBeVisible();
});
