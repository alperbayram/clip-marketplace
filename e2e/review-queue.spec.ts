import { test, expect } from "@playwright/test";
import { switchUser, uniquePostUrl, uniqueTitle } from "./fixtures";

test("creator submits a clip, admin rejects it with a reason, then approves a second one", async ({
  page,
}) => {
  await page.goto("/");
  await switchUser(page, "admin@");

  await page.goto("/admin/campaigns/new");
  const title = uniqueTitle("Review Queue Campaign");
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
  const campaignUrl = page.url();

  await switchUser(page, "alice@");
  await page.goto(campaignUrl.replace("/admin", ""));
  const rejectedUrl = uniquePostUrl();
  await page.getByLabel("Post URL").fill(rejectedUrl);
  await page.getByRole("button", { name: "Submit clip" }).click();
  await expect(page.getByText("Clip submitted for review")).toBeVisible();

  const approvedUrl = uniquePostUrl();
  await page.getByLabel("Post URL").fill(approvedUrl);
  await page.getByRole("button", { name: "Submit clip" }).click();

  await switchUser(page, "admin@");
  await page.goto(campaignUrl);

  const rejectedRow = page.getByRole("row", { name: new RegExp(rejectedUrl) });
  await rejectedRow.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // Confirm button stays disabled until a reason is entered.
  await expect(
    page.getByRole("button", { name: "Confirm rejection" }),
  ).toBeDisabled();
  await page.getByLabel("Reason").fill("Low quality clip");
  await page.getByRole("button", { name: "Confirm rejection" }).click();
  await expect(page.getByText("Submission rejected")).toBeVisible();

  const approvedRow = page.getByRole("row", { name: new RegExp(approvedUrl) });
  await approvedRow.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Submission approved")).toBeVisible();

  await switchUser(page, "alice@");
  await page.goto("/my-submissions");
  await expect(
    page.getByRole("row", { name: new RegExp(rejectedUrl) }),
  ).toContainText("rejected");
  await expect(
    page.getByRole("row", { name: new RegExp(approvedUrl) }),
  ).toContainText("approved");
});
