import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("multimodal introduction reports actual model readiness separately from API health", async ({ page }) => {
  await page.goto("/");
  const intro = page.getByRole("region", { name: "Is this news credible? Check the claims." });
  await expect(intro.getByRole("status")).toHaveText("Text model connected");
  await expect(intro).toContainText("Raw images, audio and video stay in your browser.");
  await expect(page.locator(".workspace-github")).toHaveAttribute("href", "https://github.com/Priti02707/Fake-News-Detection");
  await page.route("**/api/health", route => route.fulfill({ json: { status: "ok", model_ready: false, fact_check_configured: false } }));
  await page.reload();
  await expect(intro.getByRole("status")).toHaveText("Text model unavailable");
  await expect(page.locator(".research-badge")).toHaveText("API CONNECTED");
  await page.unroute("**/api/health");
  await page.route("**/api/health", route => route.abort());
  await page.reload();
  await expect(intro.getByRole("status")).toHaveText("Text model unavailable");
  await expect(page.locator(".research-badge")).toHaveText("API UNAVAILABLE");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("input tabs support keyboard selection and retain context notes across modes", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const textTab = page.getByRole("tab", { name: "Paste text", exact: true });
  await textTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Image", exact: true })).toBeFocused();
  await expect(page.getByRole("tabpanel", { name: "image input", exact: true })).toBeVisible();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Audio", exact: true })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(textTab).toBeFocused();
  await page.getByText("Source & verification notes (optional)", { exact: true }).click();
  await page.getByLabel("Your context and verification notes").fill("Check the event date and original publisher.");
  await page.getByLabel("Assessment mode", { exact: true }).selectOption("detect_verify");
  await page.getByText("Source & verification notes (optional)", { exact: true }).click();
  await expect(page.getByLabel("Your context and verification notes")).toHaveValue("Check the event date and original publisher.");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.getByText("Source & verification notes (optional)", { exact: true }).click();
  await expect(page.getByLabel("Your context and verification notes")).toHaveValue("");
});

test("reset cancels article extraction and preserves an empty editor", async ({ page }) => {
  let notifyRequest!: () => void;
  let releaseResponse!: () => void;
  let notifyHandled!: () => void;
  const requested = new Promise<void>(resolve => { notifyRequest = resolve; });
  const responseGate = new Promise<void>(resolve => { releaseResponse = resolve; });
  const handled = new Promise<void>(resolve => { notifyHandled = resolve; });
  await page.route("**/api/extract", async route => {
    notifyRequest(); await responseGate;
    try { await route.fulfill({ json: { title: "Old request", publisher: "example.com", url: "https://example.com/news", text: "This delayed article must not replace the cleared editor.", truncated: false } }); }
    catch { /* The browser deliberately canceled this request. */ }
    finally { notifyHandled(); }
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("tab", { name: "Article URL", exact: true }).click();
  await page.getByLabel("Article URL", { exact: true }).fill("https://example.com/news");
  await page.getByRole("button", { name: "Extract", exact: true }).click();
  await requested;
  const canceled = page.waitForEvent("requestfailed", request => request.url().endsWith("/api/extract"));
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await canceled;
  releaseResponse(); await handled;
  await expect(page.getByLabel("News article text")).toHaveValue("");
  await expect(page.getByRole("tab", { name: "Paste text", exact: true })).toHaveAttribute("aria-selected", "true");
});

test("research workspace provides a dark empty state, manual save, review, restore and deletion", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const assessment = page.getByRole("region", { name: "News assessment", exact: true });
  const saved = page.getByRole("region", { name: "Saved assessments", exact: true });
  await expect(assessment.getByRole("heading", { name: "Every claim deserves a closer look." })).toBeVisible();
  await expect(saved.getByRole("button", { name: "Save current report" })).toBeDisabled();
  await page.getByRole("button", { name: "Try an example" }).click();
  await page.getByLabel("Assessment mode", { exact: true }).selectOption("detect");
  await page.getByRole("button", { name: "Analyze article", exact: true }).click();
  await expect(assessment.getByRole("button", { name: "View full report" })).toBeVisible();
  await saved.getByLabel("Your review (not a verified label)").selectOption("needs_review");
  await saved.getByRole("button", { name: "Save current report" }).click();
  await expect(saved.locator(".saved-assessment-list article")).toHaveCount(1);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByLabel("News article text")).toHaveValue("");
  await expect(saved.locator(".saved-assessment-list article")).toHaveCount(1);
  await saved.locator(".saved-assessment-open").click();
  await expect(page.getByLabel("News article text")).toHaveValue(/city council/);
  await expect(saved.getByLabel("Your review (not a verified label)")).toHaveValue("needs_review");
  const downloading = page.waitForEvent("download");
  await saved.getByRole("button", { name: "Download saved report", exact: true }).click();
  const report = JSON.parse(await readFile((await (await downloading).path())!, "utf8"));
  expect(report.review).toBe("needs_review");
  expect(report.options.mode).toBe("detect");
  await page.reload();
  await expect(saved.locator(".saved-assessment-list article")).toHaveCount(1);
  await saved.getByRole("button", { name: "Delete saved report" }).click();
  await expect(saved.getByText("No saved assessments yet.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("verification-only reports retain their claim, notes and source after saving", async ({ page }) => {
  const claim = "The city council approved the transport budget on Tuesday.";
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByLabel("News article text").fill(claim);
  await page.getByLabel("Assessment mode", { exact: true }).selectOption("verify");
  await page.getByText("Source & verification notes (optional)", { exact: true }).click();
  await page.getByLabel("Evidence text to review").fill(claim + " Officials published the report after the public council meeting.");
  await page.getByLabel("Your context and verification notes").fill("Check the original meeting date.");
  await page.getByRole("button", { name: "Verify news", exact: true }).click();
  const saved = page.getByRole("region", { name: "Saved assessments", exact: true });
  await expect(saved.getByRole("button", { name: "Save current report" })).toBeEnabled({ timeout: 25000 });
  await saved.getByRole("button", { name: "Save current report" }).click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await saved.locator(".saved-assessment-open").click();
  await expect(page.getByLabel("Assessment mode", { exact: true })).toHaveValue("verify");
  await page.getByText("Source & verification notes (optional)", { exact: true }).click();
  await expect(page.getByLabel("Your context and verification notes")).toHaveValue("Check the original meeting date.");
  await expect(page.getByRole("region", { name: "Source verification report" }).getByText(claim, { exact: true })).toHaveCount(3);
  await saved.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(saved.getByText("No saved assessments yet.")).toBeVisible();
});
