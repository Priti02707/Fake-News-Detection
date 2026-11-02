import { test, expect } from "@playwright/test";

test("analyze, explain, save, download, and evaluate", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Enter the news", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Try an example/ }).click();
  await page.getByLabel("Save this analysis in this browser").check();
  await page.getByRole("button", { name: "Analyze article", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A little more perspective." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What influenced this prediction?" })).toBeVisible();
  await expect(page.locator(".contribution-row").first()).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download report" }).click();
  expect((await download).suggestedFilename()).toBe("fake-news-detection-analysis.json");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText(/Published fact-check search is not configured/)).toBeVisible();
  if (await page.getByRole("button", { name: "Open navigation" }).isVisible()) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Your history", exact: true }).click();
  await expect(page.getByText("1 saved analysis")).toBeVisible();
  await page.reload();
  if (await page.getByRole("button", { name: "Open navigation" }).isVisible()) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Your history", exact: true }).click();
  await expect(page.getByText("1 saved analysis")).toBeVisible();
  await page.getByRole("button", { name: "Clear history" }).click();
  await expect(page.getByText("0 saved analyses")).toBeVisible();
  if (await page.getByRole("button", { name: "Open navigation" }).isVisible()) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Model evaluation", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Two models. One evaluation protocol." })).toBeVisible();
  await expect(page.getByText("Validation-calibrated")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("short inputs abstain and private URLs show useful errors", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("News article text").fill("The city council announced a new public transport proposal on Tuesday.");
  await page.getByRole("button", { name: "Analyze article", exact: true }).click();
  await expect(page.getByRole("heading", { name: "More context needed" })).toBeVisible();
  await page.getByRole("tab", { name: "Article URL" }).click();
  await page.getByLabel("Article URL", { exact: true }).fill("http://127.0.0.1");
  await page.getByRole("button", { name: "Extract", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Private, local, and reserved" })).toBeVisible();
});
