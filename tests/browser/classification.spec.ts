import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("dashboard loads actual capabilities and theme selection persists", async ({ page }) => {
  await page.goto("/");
  const dashboard = page.getByRole("region", { name: "Classification dashboard" });
  await expect(dashboard.getByRole("button", { name: /Audio detection/ })).toContainText("acoustic classifier not evaluated");
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  const theme = await page.locator("html").getAttribute("data-theme");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme!);
  await dashboard.getByRole("button", { name: /Audio detection/ }).click();
  await expect(page.getByRole("tab", { name: "Audio", exact: true })).toHaveAttribute("aria-selected", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("audio rejects mislabeled, oversized and silent files before model download", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Audio", exact: true }).click();
  const input = page.getByLabel("Choose audio", { exact: true });
  const alert = page.locator(".media-input [role=alert]");
  await input.setInputFiles({ name: "fake.wav", mimeType: "audio/wav", buffer: Buffer.from("unrelated contents") });
  await expect(alert).toContainText("contents do not match");
  await input.setInputFiles({ name: "large.wav", mimeType: "audio/wav", buffer: Buffer.alloc(20 * 1024 * 1024 + 1) });
  await expect(alert).toContainText("20 MB");
  // One second of real PCM silence, decoded by the browser without a mock.
  const wav = Buffer.alloc(44 + 32000);
  wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(32000, 40);
  await input.setInputFiles({ name: "silence.wav", mimeType: "audio/wav", buffer: wav });
  await expect(page.locator("audio")).toBeVisible();
  await page.getByRole("button", { name: "Transcribe audio", exact: true }).click();
  await expect(alert).toContainText("appears to be silent");
  await expect(page.getByRole("button", { name: "Transcribe audio", exact: true })).toBeEnabled();
});

test("actual audio transcription is reviewed and exported with honest prediction scope", async ({ page, request }) => {
  test.skip(process.env.MEDIA_INTEGRATION !== "1", "Downloads the Whisper model and a public-domain speech fixture.");
  test.setTimeout(600000);
  const response = await request.get("https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/jfk.wav");
  expect(response.ok()).toBe(true);
  await page.goto("/");
  await page.getByRole("tab", { name: "Audio", exact: true }).click();
  await page.getByLabel("Choose audio", { exact: true }).setInputFiles({ name: "jfk.wav", mimeType: "audio/wav", buffer: await response.body() });
  await page.getByRole("button", { name: "Transcribe audio", exact: true }).click();
  const review = page.getByLabel("Review audio transcript", { exact: true });
  await expect(review).toHaveValue(/country/i, { timeout: 500000 });
  await page.getByRole("button", { name: "Classify reviewed words", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Full-media prediction: Uncertain" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Audio findings" })).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download report", exact: true }).click();
  const report = JSON.parse(await readFile((await (await downloaded).path())!, "utf8"));
  expect(report.media_trace.kind).toBe("audio");
  expect(report.media_trace.segments.length).toBeGreaterThan(0);
  expect(report.report.prediction_scope).toBe("reviewed_media_text");
  expect(report.report.media_classification.confidence).toBeNull();
});
