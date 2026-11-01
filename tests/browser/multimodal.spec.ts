import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function uploadImage(page: Page, name = "synthetic-news.png") {
  const image = await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = 100; canvas.height = 100;
    const context = canvas.getContext("2d")!; context.fillStyle = "green"; context.fillRect(0, 0, 100, 100);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.getByLabel("Choose image", { exact: true }).setInputFiles({ name, mimeType: "image/png", buffer: Buffer.from(image, "base64") });
  await page.getByText("Explore image context (experimental)", { exact: true }).click();
}

test("image mismatch gathers cited passages, preserves conflicts and exports media context", async ({ page }) => {
  // Synthetic worker/provider fixtures verify orchestration, not real model accuracy.
  await page.addInitScript(() => {
    class FixtureWorker {
      onmessage: ((event: { data: unknown }) => void) | null = null;
      postMessage(data: { captions: string[] }) {
        queueMicrotask(() => this.onmessage?.({ data: { status: "complete", model: "synthetic-CLIP-test-fixture", revision: "fixture", results: [{ label: data.captions[1], score: .9 }, { label: data.captions[0], score: .1 }] } }));
      }
      terminate() {}
    }
    window.Worker = FixtureWorker as unknown as typeof Worker;
  });
  await page.route("**/api/coverage", route => route.fulfill({ json: { status: "matches", message: "Synthetic source discovery fixtures; not real reporting.", results: [
    { url: "https://example.com/first", title: "First synthetic source", publisher: "example.com" },
    { url: "https://example.org/second", title: "Second synthetic source", publisher: "example.org" }
  ] } }));
  await page.route("**/api/evidence", route => {
    const url = route.request().postDataJSON().url as string;
    const text = url.includes("first") ? "The city council approved the transport budget on Tuesday." : "The city council did not approve the transport budget on Tuesday.";
    return route.fulfill({ json: { source: { title: "Synthetic evidence fixture", publisher: new URL(url).hostname, url, published_date: "2020-01-01", truncated: false }, passages: [{ id: "fixture", text, start: 0, end: text.length, retrieval_score: 1 }], retrieved_at: "2026-11-01T12:00:00Z" } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Image–news mismatch/ }).click();
  await uploadImage(page);
  await page.getByLabel("Description to investigate", { exact: true }).fill("The city council approved the transport budget on Tuesday.");
  await page.getByLabel("Alternative description", { exact: true }).fill("A photograph of a green landscape");
  await page.getByRole("button", { name: "Compare image descriptions" }).click();
  await expect(page.getByText("Potential image–caption mismatch to investigate", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Investigate this image claim", exact: true }).click();
  const notebook = page.locator(".media-evidence-case");
  await expect(notebook.locator(".citation")).toHaveCount(2);
  await expect(notebook.getByText("Insufficient reviewed evidence", { exact: true })).toBeVisible();
  await notebook.getByLabel("Your assessment of this passage").nth(0).selectOption("supports");
  await notebook.getByLabel("Your assessment of this passage").nth(1).selectOption("contradicts");
  await expect(notebook.getByText("Conflicting reader assessments", { exact: true })).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await notebook.getByRole("button", { name: "Export evidence report" }).click();
  const report = JSON.parse(await readFile((await (await downloaded).path())!, "utf8"));
  expect(report.media_context.filename).toBe("synthetic-news.png");
  expect(report.media_context.visual_review.status).toBe("potential_mismatch");
  expect(report.claim_verification.assessment).toBe("MIXED");
  expect(report.claim_verification.assessment_author).toBe("reader");
  expect(report.automated_factual_assessment).toBe("INSUFFICIENT_EVIDENCE");
  expect(report.citations.map((item: { source: { url: string } }) => item.source.url)).toEqual(["https://example.com/first", "https://example.org/second"]);
  // Ensure nested notebook content survives the print stylesheet.
  await page.evaluate(() => { document.body.dataset.mediaEvidencePrint = "true"; });
  await page.emulateMedia({ media: "print" });
  await expect(notebook.locator(".citation").first()).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => { delete document.body.dataset.mediaEvidencePrint; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("image evidence handles unavailable providers and resets on file replacement", async ({ page }) => {
  await page.route("**/api/coverage", route => route.fulfill({ json: { status: "unavailable", message: "Recent news search is temporarily unavailable.", results: [] } }));
  await page.route("**/api/fact-check", route => route.fulfill({ json: { status: "unavailable", message: "Published fact-check search is not configured.", search_url: "https://toolbox.google.com/factcheck/explorer/", results: [] } }));
  await page.goto("/");
  await page.getByRole("tab", { name: "Image", exact: true }).click();
  await uploadImage(page);
  await page.getByLabel("Description to investigate", { exact: true }).fill("The city council approved its transport budget.");
  await page.getByRole("button", { name: "Investigate this image claim" }).click();
  const notebook = page.locator(".media-evidence-case");
  await expect(notebook.getByText("Recent news search is temporarily unavailable.", { exact: true })).toBeVisible();
  await notebook.getByLabel("Evidence search provider").selectOption("fact_checks");
  await notebook.getByRole("button", { name: "Search recent coverage" }).click();
  await expect(notebook.getByText("Published fact-check search is not configured.", { exact: true })).toBeVisible();
  await expect(notebook.getByRole("link", { name: "Search published fact-checks manually" })).toBeVisible();
  await expect(notebook.locator(".citation")).toHaveCount(0);
  // Choosing another file clears its predecessor's claim and investigation.
  await page.getByLabel("Choose image", { exact: true }).setInputFiles([]);
  await expect(notebook).toHaveCount(0);
});

test("restored video timeline links timestamped review flags to evidence", async ({ page }) => {
  const text = "The city council approved the transport budget on Tuesday.";
  const trace = { filename: "synthetic-timeline.webm", kind: "video", language: "en", original_text: text,
    segments: [{ text, start: 1, end: 4 }], frames: [{ id: "frame-1", timestamp: 2, width: 640, height: 360, text: "The city council did not approve the transport budget on Tuesday.", scene_change: .2, ocr_status: "text_found" }] };
  await page.addInitScript(saved => localStorage.setItem("verity.history.v1", JSON.stringify([saved])), { id: "synthetic-timeline", date: "2026-11-01T12:00:00Z", text, mediaTrace: trace, result: { verdict: "uncertain", model: "logistic", model_name: "Synthetic history fixture", confidence: null, real_probability: null, explanations: [], reasons: ["Synthetic UI fixture"], claims: [{ text, status: "unverified" }], note: "Synthetic fixture", word_count: 10, elapsed_ms: 0 } });
  await page.route("**/api/coverage", route => route.fulfill({ json: { status: "no_matches", message: "No source leads in this deterministic fixture.", results: [] } }));
  await page.goto("/");
  if (await page.getByRole("button", { name: "Open navigation" }).isVisible()) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Your history", exact: true }).click();
  await page.locator(".history-open").click();
  await expect(page.getByRole("heading", { name: "Video investigation timeline" })).toBeVisible();
  await expect(page.locator(".timeline-entry").nth(1)).toContainText("differ in negation");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download timeline JSON" }).click();
  const report = JSON.parse(await readFile((await (await downloaded).path())!, "utf8"));
  expect(report.timeline.map((item: { timestamp: number }) => item.timestamp)).toEqual([1, 2]);
  expect(report.factual_assessment).toBe("INSUFFICIENT_EVIDENCE");
  await page.getByRole("button", { name: "Investigate this moment with sources" }).nth(1).click();
  await expect(page.locator(".media-evidence-origin")).toContainText("2.0 seconds");
  await expect(page.getByLabel("Claim to investigate", { exact: true })).toHaveValue(trace.frames[0].text);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
