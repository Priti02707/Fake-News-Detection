import { expect, test } from "@playwright/test";

async function openWorld(page: import("@playwright/test").Page) {
  await page.goto("/");
  if (await page.getByRole("button", { name: "Open navigation" }).isVisible()) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "World news check", exact: true }).click();
}

test("world search sends filters, preserves ratings and opens the evidence notebook", async ({ page }) => {
  await page.route("**/api/world-news", async route => {
    expect(route.request().postDataJSON()).toEqual({ query: "A specific international news claim", language: "es", country: "brazil", timespan: "7d" });
    await route.fulfill({ json: { query: "A specific international news claim", checked_at: "2026-11-02T10:00:00Z", note: "Source leads require review.", news: { status: "matches", message: "Related reporting.", results: [{ url: "https://example.com/report", title: "International report", publisher: "example.com", country: "Brazil", language: "Spanish" }] }, fact_checks: { status: "matches", message: "Related published reviews.", results: [{ url: "https://example.org/review", title: "Published review", publisher: "Independent reviewer", claim: "A related claim", rating: "Misleading", date: "2026-11-01" }] } } });
  });
  await openWorld(page);
  await page.getByLabel("World news claim or keywords").fill("A specific international news claim");
  await page.getByLabel("Source language", { exact: true }).selectOption("es");
  await page.getByLabel("News publisher country").selectOption("brazil");
  await page.getByLabel("News coverage window").selectOption("7d");
  await page.getByRole("button", { name: "Check world news", exact: true }).click();
  await expect(page.getByText("Publisher’s rating: Misleading", { exact: true })).toBeVisible();
  await expect(page.getByText(/Review needed · Checked/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("region", { name: "International news coverage" }).getByRole("button", { name: "Review this source" }).click();
  await expect(page.getByLabel("Claim to investigate", { exact: true })).toHaveValue("A specific international news claim");
  await page.getByRole("button", { name: "Inspect: International report" }).click();
  await expect(page.getByLabel("Evidence source URL", { exact: true })).toHaveValue("https://example.com/report");
});

test("world search shows unavailable and empty states and clears stale results", async ({ page }) => {
  await page.route("**/api/world-news", route => route.fulfill({ json: { query: "A specific international claim", checked_at: "2026-11-02T10:00:00Z", note: "No automated factual verdict.", news: { status: "no_matches", message: "No recent coverage found.", results: [] }, fact_checks: { status: "unavailable", message: "Published reviews require configuration.", search_url: "https://toolbox.google.com/factcheck/explorer/search/test", results: [] } } }));
  await openWorld(page);
  await page.getByLabel("World news claim or keywords").fill("A specific international claim");
  await page.getByRole("button", { name: "Check world news", exact: true }).click();
  await expect(page.getByText(/Provider unavailable/)).toBeVisible();
  await expect(page.getByText(/No matches. No recent coverage found/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Search Fact Check Explorer manually/ })).toBeVisible();
  await page.getByLabel("Source language", { exact: true }).selectOption("hi");
  await expect(page.getByText(/Review needed · Checked/)).toHaveCount(0);
});
