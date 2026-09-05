import type { Page } from "@playwright/test";

export async function switchUser(page: Page, emailSubstring: string) {
  await page.getByLabel("Switch user").click();
  await page.getByRole("option", { name: new RegExp(emailSubstring) }).click();
  await page.waitForLoadState("networkidle");
}

export function uniqueTitle(prefix: string) {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function uniquePostUrl() {
  const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return `https://www.tiktok.com/@e2e/video/${id}`;
}
