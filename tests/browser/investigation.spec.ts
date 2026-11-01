import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function openNotebook(page: import("@playwright/test").Page) {
  await page.goto("/");
  if (await page.getByRole("button", { name: "Open navigation" }).isVisible()) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Investigate claims", exact: true }).click();
  await page.getByLabel("Claim to investigate", { exact: true }).fill("The city council approved the transport budget on Tuesday.");
}

test("citations require reader review, export source traces, and reset on claim edits", async ({ page }) => {
  await openNotebook(page);
  await page.getByRole("button", { name: "Paste source text", exact: true }).click();
  await page.getByLabel("Evidence source text", { exact: true }).fill("The city council approved the transport budget on Tuesday. The botanical garden has many tropical plants.");
  await page.getByRole("button", { name: "Find source passages" }).click();
  await expect(page.locator(".citation")).toHaveCount(1);
  await expect(page.getByText("Insufficient reviewed evidence", { exact: true })).toBeVisible();
  await page.getByLabel("Your assessment of this passage").selectOption("supports");
  await expect(page.getByText("Reader assessment: supporting evidence", { exact: true })).toBeVisible();
  await page.getByLabel("Your reasoning and context").fill("Illustrative test text; no authenticated publisher.");
  await page.getByLabel("Evidence source text", { exact: true }).fill("The city council did not approve the transport budget on Tuesday.");
  await page.getByRole("button", { name: "Find source passages" }).click();
  await expect(page.locator(".citation")).toHaveCount(2);
  await page.getByLabel("Your assessment of this passage").nth(1).selectOption("contradicts");
  await expect(page.getByText("Conflicting reader assessments", { exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export evidence report" }).click();
  const downloaded = await download;
  expect(downloaded.suggestedFilename()).toBe("verity-investigation.json");
  const report = JSON.parse(await readFile((await downloaded.path())!, "utf8"));
  expect(report.assessment_author).toBe("reader");
  expect(report.assessment).toBe("Conflicting reader assessments");
  expect(report.citations).toHaveLength(2);
  expect(report.citations[0].source.url).toBeNull();
  expect(report.citations[0].note).toContain("Illustrative test text");
  await page.getByLabel("Claim to investigate", { exact: true }).fill("A different claim about the transport budget and council.");
  await expect(page.locator(".citation")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("recent-news leads can fill a source URL without claiming verification", async ({ page }) => {
  await page.route("**/api/coverage", route => route.fulfill({ json: { status: "matches", message: "Recent news leads, not verified fact-checks.", results: [{ url: "https://example.com/report", title: "Transport report", publisher: "example.com", indexed_at: "20261101T120000Z" }] } }));
  await openNotebook(page);
  await page.getByText("Discover recent news sources", { exact: true }).click();
  await page.getByLabel("News search keywords").fill("public transport");
  await page.getByRole("button", { name: "Search recent coverage" }).click();
  await expect(page.getByText("Recent news leads, not verified fact-checks.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Use this source" }).click();
  await expect(page.getByLabel("Evidence source URL", { exact: true })).toHaveValue("https://example.com/report");
  await expect(page.getByText("Insufficient reviewed evidence", { exact: true })).toBeVisible();
});

test("local semantic ranking and NLI distinguish direct support and contradiction", async ({ page }) => {
  test.skip(process.env.RESEARCH_INTEGRATION !== "1", "Downloads real semantic and entailment models.");
  test.setTimeout(600000);
  await openNotebook(page);
  await page.getByRole("button", { name: "Paste source text", exact: true }).click();
  await page.getByLabel("Evidence source text", { exact: true }).fill("The city council approved the transport budget on Tuesday. The city council did not approve the transport budget on Tuesday.");
  await page.getByRole("button", { name: "Find source passages" }).click();
  await expect(page.locator(".citation")).toHaveCount(2);
  await page.getByRole("button", { name: "Compare evidence with AI" }).click();
  await page.locator(".model-relation, .investigation-card [role=alert]").first().waitFor({ state: "visible", timeout: 500000 });
  await expect(page.getByText(/Model suggests textual support/)).toBeVisible();
  await expect(page.getByText(/Model suggests textual contradiction/)).toBeVisible();
  await expect(page.getByText("Insufficient reviewed evidence", { exact: true })).toBeVisible();
});

test("Content Credentials reader handles unsigned and signed media", async ({ page, request }) => {
  test.skip(process.env.RESEARCH_INTEGRATION !== "1", "Downloads the real C2PA reader and a public C2PA fixture.");
  test.setTimeout(180000);
  await page.goto("/");
  await page.getByRole("tab", { name: "Image", exact: true }).click();
  const image = await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 40; c.height = 40; return c.toDataURL("image/png").split(",")[1]; });
  await page.getByLabel("Choose image", { exact: true }).setInputFiles({ name: "unsigned.png", mimeType: "image/png", buffer: Buffer.from(image, "base64") });
  await page.getByRole("button", { name: "Inspect Content Credentials" }).click();
  await expect(page.getByText(/No embedded Content Credentials were found/)).toBeVisible({ timeout: 65000 });
  const response = await request.get("https://raw.githubusercontent.com/contentauth/c2pa-rs/main/sdk/tests/fixtures/C.jpg");
  expect(response.ok()).toBe(true);
  await page.getByLabel("Choose image", { exact: true }).setInputFiles({ name: "signed-example.jpg", mimeType: "image/jpeg", buffer: await response.body() });
  await page.getByRole("button", { name: "Inspect Content Credentials" }).click();
  await expect(page.getByText(/Embedded Content Credentials found/)).toBeVisible({ timeout: 65000 });
  await expect(page.getByRole("button", { name: "Download credential report" })).toBeVisible();
});

test("visual-language comparison exposes relative matches without authenticity verdicts", async ({ page, request }) => {
  test.skip(process.env.RESEARCH_INTEGRATION !== "1", "Downloads the real CLIP model and its documented example image.");
  test.setTimeout(600000);
  await page.goto("/");
  await page.getByRole("tab", { name: "Image", exact: true }).click();
  const response = await request.get("https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/tiger.jpg");
  expect(response.ok()).toBe(true);
  await page.getByLabel("Choose image", { exact: true }).setInputFiles({ name: "tiger.jpg", mimeType: "image/jpeg", buffer: await response.body() });
  await page.getByText("Explore image context (experimental)", { exact: true }).click();
  await page.getByLabel("Description to investigate", { exact: true }).fill("a photograph of a tiger");
  await page.getByLabel("Alternative description", { exact: true }).fill("a photograph of a horse");
  await page.getByRole("button", { name: "Compare image descriptions" }).click();
  await page.locator(".visual-match, .image-context [role=status]").filter({ hasText: /relative match|could not finish/ }).first().waitFor({ state: "visible", timeout: 500000 });
  await expect(page.locator(".visual-match")).toHaveCount(2);
  await expect(page.locator(".visual-match").first()).toContainText("tiger");
  await expect(page.getByText(/These scores are not probabilities of truth/)).toBeVisible();
});
