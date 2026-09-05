import { test, expect } from "@playwright/test";
import { switchUser, uniquePostUrl, uniqueTitle } from "./fixtures";

test("creator can browse active campaigns, submit a clip, and see it in my submissions", async ({
  page,
}) => {
  await page.goto("/");
  await switchUser(page, "admin@");

  await page.goto("/admin/campaigns/new");
  const title = uniqueTitle("Browse Campaign");
  await page.getByLabel("Title").fill(title);
  await page.getByRole("checkbox", { name: "tiktok" }).click();
  await page.getByLabel("Payout per 1,000 views (cents)").fill("100");
  await page.getByLabel("Total budget (cents)").fill("100000");
  await page.getByLabel("Starts at").fill("2026-01-01");
  await page.getByLabel("Ends at").fill("2026-12-31");
  await page.getByRole("combobox", { name: "Status" }).click();
  await page.getByRole("option", { name: "active" }).click();
  await page.getByRole("button", { name: "Create campaign" }).click();
  await expect(page).toHaveURL(/\/admin\/campaigns\/[0-9a-f-]+$/);

  await switchUser(page, "bob@");
  await page.goto("/campaigns");
  await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  await page.getByRole("link", { name: new RegExp(title) }).click();

  const postUrl = uniquePostUrl();
  await page.getByLabel("Post URL").fill(postUrl);
  await page.getByRole("button", { name: "Submit clip" }).click();
  await expect(page.getByText("Clip submitted for review")).toBeVisible();

  await page.goto("/my-submissions");
  const row = page.getByRole("row", { name: new RegExp(postUrl) });
  await expect(row).toBeVisible();
  await expect(row).toContainText("pending");
  await expect(row).toContainText("$0.00");

  // Submitting the same URL to the same campaign again must fail.
  await page.goto("/campaigns");
  await page.getByRole("link", { name: new RegExp(title) }).click();
  await page.getByLabel("Post URL").fill(postUrl);
  await page.getByRole("button", { name: "Submit clip" }).click();
  await expect(
    page.getByText("You've already submitted this URL to this campaign."),
  ).toBeVisible();
});
