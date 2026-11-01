import { test, expect } from "@playwright/test";

test("media uploads validate files without losing the current article", async ({ page }) => {
  await page.goto("/");
  const article = "The city council announced a public transport proposal for residents to discuss at a meeting next Tuesday.";
  await page.getByLabel("News article text").fill(article);
  await page.getByRole("tab", { name: "Image", exact: true }).click();
  await page.getByLabel("Choose image", { exact: true }).setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("Not an image") });
  await expect(page.locator(".media-input [role=alert]")).toContainText("Choose a PNG, JPEG, or WebP");
  await page.getByLabel("Choose image", { exact: true }).setInputFiles({ name: "empty.png", mimeType: "image/png", buffer: Buffer.alloc(0) });
  await expect(page.locator(".media-input [role=alert]")).toContainText("non-empty");
  await page.getByRole("tab", { name: "Video", exact: true }).click();
  await page.getByLabel("Choose video", { exact: true }).setInputFiles({ name: "broken.mp4", mimeType: "video/mp4", buffer: Buffer.from("Not a video") });
  await page.getByRole("button", { name: "Transcribe video" }).click();
  await expect(page.locator(".media-input [role=alert]")).toContainText("cannot open this video");
  await page.getByRole("tab", { name: "Paste text" }).click();
  await expect(page.getByLabel("News article text")).toHaveValue(article);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("image extraction requires review before sending text for analysis", async ({ page }, testInfo) => {
  test.setTimeout(180000);
  test.skip(process.env.MEDIA_INTEGRATION !== "1", "Downloads OCR models; run MEDIA_INTEGRATION=1 for real extraction checks.");
  let analyses = 0;
  page.on("request", request => { if (request.url().endsWith("/api/analyze")) analyses++; });
  await page.goto("/");
  const image = await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 500;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "black"; ctx.font = "28px Arial";
    ["The city council announced a new public transport proposal on Tuesday.", "Two additional bus routes would connect residential neighborhoods", "with the central railway station. Officials said the proposal would", "be open for public comment for thirty days before a final vote.", "Residents can submit feedback or attend a public meeting next month."].forEach((line, i) => ctx.fillText(line, 35, 65 + i * 65));
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.getByRole("tab", { name: "Image", exact: true }).click();
  await page.getByLabel("Choose image", { exact: true }).setInputFiles({ name: "news.png", mimeType: "image/png", buffer: Buffer.from(image, "base64") });
  await page.getByRole("button", { name: "Extract image text" }).click();
  const review = page.getByLabel("Review extracted text", { exact: true });
  await page.locator(".media-review, .media-input [role=alert]").waitFor({ state: "visible", timeout: 150000 });
  await expect(review).toHaveValue(/city council/);
  expect(analyses).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("image-review.png"), fullPage: true });
  await review.fill((await review.inputValue()) + " The funding remains subject to approval.");
  await page.getByRole("button", { name: "Use reviewed text" }).click();
  await expect(page.getByLabel("News article text")).toHaveValue(/funding remains subject to approval/);
  expect(analyses).toBe(0);
  await page.getByRole("button", { name: "Analyze article", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A little more perspective." })).toBeVisible();
  expect(analyses).toBe(1);
});

test("video speech is extracted and reviewed before analysis", async ({ page, request }) => {
  test.setTimeout(600000);
  test.skip(process.env.MEDIA_INTEGRATION !== "1", "Downloads the speech model; run MEDIA_INTEGRATION=1 for real extraction checks.");
  await page.goto("/");
  // Public-domain JFK speech sample used in the Transformers.js documentation.
  const response = await request.get("https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/jfk.wav");
  expect(response.ok()).toBe(true);
  const wav = (await response.body()).toString("base64");
  const video = await page.evaluate(async (encoded) => {
    const context = new AudioContext();
    const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    const audio = await context.decodeAudioData(bytes.buffer);
    const source = context.createBufferSource(); source.buffer = audio;
    const destination = context.createMediaStreamDestination(); source.connect(destination);
    const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 180;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#285b43"; ctx.fillRect(0, 0, 320, 180);
    const stream = canvas.captureStream(5);
    destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8,opus" });
    const chunks: Blob[] = [];
    const finished = new Promise<Blob>(resolve => {
      recorder.ondataavailable = event => chunks.push(event.data);
      recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
    });
    recorder.start(); source.start();
    await new Promise<void>(resolve => { source.onended = () => resolve(); });
    recorder.stop();
    const blob = await finished;
    stream.getTracks().forEach(track => track.stop());
    await context.close();
    const buffer = new Uint8Array(await blob.arrayBuffer());
    let binary = ""; for (const byte of buffer) binary += String.fromCharCode(byte);
    return btoa(binary);
  }, wav);
  await page.getByRole("tab", { name: "Video", exact: true }).click();
  await page.getByLabel("Choose video", { exact: true }).setInputFiles({ name: "speech.webm", mimeType: "video/webm", buffer: Buffer.from(video, "base64") });
  await page.getByRole("button", { name: "Transcribe video" }).click();
  const review = page.getByLabel("Review video transcript", { exact: true });
  await page.locator(".media-review, .media-input [role=alert]").waitFor({ state: "visible", timeout: 500000 });
  await expect(review).toHaveValue(/country/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Use reviewed text" }).click();
  await expect(page.getByLabel("News article text")).toHaveValue(/country/i);
  await page.getByRole("button", { name: "Analyze article", exact: true }).click();
  await expect(page.getByRole("heading", { name: "More context needed" })).toBeVisible();
});
