import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const claim = "The city council approved the transport budget on Tuesday.";
const sourceText = claim + " Officials published the final budget after the public council meeting.";

test("combined assessment shows detection and source evidence, exports and saves both", async ({ page }) => {
  await page.route("**/api/v2/assess", async route => {
    const payload = route.request().postDataJSON();
    expect(payload.mode).toBe("detect_verify");
    expect(payload.claim).toBe(claim);
    expect(payload.source_text).toBe(sourceText);
    // Exercise the actual production classifier; only external verification is
    // controlled so this test does not depend on search-provider availability.
    const detection = await page.request.post("/api/v2/analyze/text", { data: { text: payload.text } });
    const classified = await detection.json();
    await route.fulfill({ json: { ...classified, mode: payload.mode, classification_error: null, verification: {
      status: "review_required", assessment: "INSUFFICIENT_EVIDENCE", confidence: null, claim, claim_selection: "reader_selected", checked_at: "2026-11-02T10:00:00Z",
      news: { status: "unavailable", message: "News search temporarily unavailable.", results: [] },
      fact_checks: { status: "matches", message: "Related publisher review.", results: [{ url: "https://example.org/review", title: "Published review", publisher: "Example reviewer", rating: "Misleading" }] },
      evidence: [{ source: { title: "Pasted source", publisher: "Not authenticated", url: null }, passages: [{ id: "p1", text: claim, start: 0, end: claim.length }], date_context: { message: "Publication date is unknown." }, retrieved_at: "2026-11-02T10:00:00Z" }], warnings: [], reader_notes: "Check event date.", explanation: "Sources need review; no automated factual verdict is established."
    } } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Try an example" }).click();
  await page.getByLabel("Assessment mode", { exact: true }).selectOption("detect_verify");
  await page.getByText("Source & verification notes (optional)", { exact: true }).click();
  await page.getByLabel("Specific claim to verify").fill(claim);
  await page.getByLabel("Evidence text to review").fill(sourceText);
  await page.getByLabel("Your context and verification notes").fill("Check event date.");
  await page.getByLabel("Save this analysis in this browser").check();
  await page.getByRole("button", { name: "Detect & verify news", exact: true }).click();
  const verification = page.getByRole("region", { name: "Source verification report" });
  await expect(verification.getByText("Factual assessment: Insufficient evidence")).toBeVisible();
  await expect(verification.getByText("Publisher’s rating: Misleading", { exact: true })).toBeVisible();
  await expect(verification.getByText(claim, { exact: true })).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "A little more perspective." })).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download report", exact: true }).click();
  const report = JSON.parse(await readFile((await (await downloading).path())!, "utf8"));
  expect(report.source_verification.claim).toBe(claim);
  expect(report.source_verification.assessment).toBe("INSUFFICIENT_EVIDENCE");
  expect(report.analysis).toBeTruthy();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("verity.history.v1") || "[]")[0].verification.claim)).toBe(claim);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel("News article text").fill("A different news article is being reviewed today.");
  await expect(verification).toHaveCount(0);
});

test("verification only retrieves real pasted evidence and never displays a model prediction", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("News article text").fill(claim);
  await page.getByLabel("Assessment mode", { exact: true }).selectOption("verify");
  await page.getByText("Source & verification notes (optional)", { exact: true }).click();
  await page.getByLabel("Specific claim to verify").fill(claim);
  await page.getByLabel("Evidence text to review").fill(sourceText);
  await page.getByRole("button", { name: "Verify news", exact: true }).click();
  const verification = page.getByRole("region", { name: "Source verification report" });
  await expect(verification).toBeVisible({ timeout: 25000 });
  await expect(verification.locator(".verification-quotes blockquote").first()).toHaveText(claim);
  await expect(page.getByRole("heading", { name: "A little more perspective." })).toHaveCount(0);
  await expect(page.getByLabel("Save this analysis in this browser")).toBeDisabled();
});

test("unexpected client rendering failures show a recovery screen", async ({ page }) => {
  await page.addInitScript(() => { window.matchMedia = () => { throw new Error("Simulated browser environment failure"); }; });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "The app could not load" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reload application" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open alternate public address" })).toHaveAttribute("href", "https://verity-news-sable.vercel.app/");
});
