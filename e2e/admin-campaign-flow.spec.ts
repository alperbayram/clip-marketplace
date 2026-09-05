import { test, expect } from "@playwright/test";
import { switchUser, uniqueTitle } from "./fixtures";

test("admin can create a campaign, see it in the list, and edit it", async ({
  page,
}) => {
  await page.goto("/");
  await switchUser(page, "admin@");

  await page.goto("/admin/campaigns/new");
  const title = uniqueTitle("E2E Campaign");

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
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  await page.goto("/admin/campaigns");
  await page.getByPlaceholder("Search by title…").fill(title);
  await expect(page.getByRole("link", { name: title })).toBeVisible();

  await page.getByRole("link", { name: title }).click();
  await page.getByRole("button", { name: "Edit" }).click();
  const newTitle = `${title} (edited)`;
  await page.getByLabel("Title").fill(newTitle);
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByRole("heading", { name: newTitle })).toBeVisible();
});
