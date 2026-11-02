import { expect, test } from "@playwright/test";

test("project identity and developer attribution remain accessible on desktop and mobile", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle("Fake News Detection — News Analysis & Evidence");
  await expect(page.locator('meta[name="author"]')).toHaveAttribute("content", "Priti Kumari");
  const brand = page.locator(".brand:visible");
  await expect(brand).toContainText("Fake News");
  await expect(brand).toContainText("Detection");
  await expect(page.locator("footer").getByRole("link", { name: "Priti Kumari", exact: true })).toHaveAttribute("href", "https://github.com/Priti02707");
  if (await page.getByRole("button", { name: "Open navigation" }).isVisible()) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "How it works", exact: true }).click();
  const developer = page.getByRole("region", { name: "Project developer" });
  await expect(developer.getByRole("heading", { name: "Priti Kumari", exact: true })).toBeVisible();
  await expect(developer.getByText("Project Owner & Developer", { exact: true })).toBeVisible();
  await expect(developer.getByRole("link", { name: /GitHub: Priti02707/ })).toHaveAttribute("href", "https://github.com/Priti02707");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
