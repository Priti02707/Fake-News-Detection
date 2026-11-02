import { test, expect, type Page } from "@playwright/test";
import { createTimelineVideo } from "./video-fixture";

type DroppedFile = { name: string; type: string; bytes: number[] };
async function drop(page: Page, area: string, files: DroppedFile[] = [], text = "", uri = "") {
  const data = await page.evaluateHandle(({ files, text, uri }) => {
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(new File([new Uint8Array(file.bytes)], file.name, { type: file.type }));
    if (text) transfer.setData("text/plain", text);
    if (uri) transfer.setData("text/uri-list", uri);
    return transfer;
  }, { files, text, uri });
  const target = page.getByRole("group", { name: area, exact: true });
  await target.dispatchEvent("dragenter", { dataTransfer: data });
  await expect(target).toHaveClass(/drag-active/);
  await target.dispatchEvent("dragover", { dataTransfer: data });
  await target.dispatchEvent("drop", { dataTransfer: data });
  await expect(target).not.toHaveClass(/drag-active/);
  await data.dispose();
}

test("text drops accept selections and files and preserve content on invalid input", async ({ page }) => {
  await page.goto("/");
  let analyses = 0;
  page.on("request", request => { if (request.url().includes("/api/v2/analyze/")) analyses++; });
  const text = "The city council announced a transport proposal for public review on Tuesday.";
  await drop(page, "Text drop area", [], text);
  await expect(page.getByLabel("News article text")).toHaveValue(text);
  const file = { name: "article.md", type: "text/markdown", bytes: [...Buffer.from(text + " Residents may submit feedback.")] };
  await drop(page, "Text drop area", [file]);
  await expect(page.getByLabel("News article text")).toHaveValue(/Residents/);
  await drop(page, "Text drop area", [{ ...file, name: "article.pdf", type: "application/pdf" }]);
  await expect(page.locator(".error-message[role=alert]")).toContainText(".txt or .md");
  await expect(page.getByLabel("News article text")).toHaveValue(/Residents/);
  await drop(page, "Text drop area", [], "x".repeat(20001));
  await expect(page.locator(".error-message[role=alert]")).toContainText("20,000");
  await drop(page, "Text drop area", [file, file]);
  await expect(page.locator(".error-message[role=alert]")).toContainText("one text file");
  await page.getByLabel("Choose text file").setInputFiles({ name: "article.txt", mimeType: "text/plain", buffer: Buffer.from(text) });
  await expect(page.getByLabel("News article text")).toHaveValue(text);
  expect(analyses).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("URL drops accept browser links and reject unsafe or multiple links without fetching", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Article URL" }).click();
  let extracts = 0;
  page.on("request", request => { if (request.url().endsWith("/api/extract")) extracts++; });
  await drop(page, "Article URL drop area", [], "", "# dragged browser link\r\nhttps://example.com/news");
  await expect(page.getByLabel("Article URL", { exact: true })).toHaveValue("https://example.com/news");
  await drop(page, "Article URL drop area", [], "javascript:alert(1)");
  await expect(page.locator(".error-message[role=alert]")).toContainText("HTTP or HTTPS");
  await drop(page, "Article URL drop area", [], "https://example.org/one\nhttps://example.org/two");
  await expect(page.locator(".error-message[role=alert]")).toContainText("one article URL");
  await expect(page.getByLabel("Article URL", { exact: true })).toHaveValue("https://example.com/news");
  expect(extracts).toBe(0);
});

for (const kind of ["image", "audio", "video"] as const) {
  test(`${kind} drops show previews and enforce one matching file`, async ({ page }) => {
    await page.goto("/");
    const image = await page.evaluate(() => {
      const canvas = document.createElement("canvas"); canvas.width = 32; canvas.height = 32;
      return canvas.toDataURL("image/png").split(",")[1];
    });
    const wav = Buffer.alloc(44 + 32000);
    wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28);
    wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(32000, 40);
    const bytes = kind === "image" ? Buffer.from(image, "base64") : kind === "audio" ? wav : await createTimelineVideo(page);
    const file = { name: `dropped.${kind === "image" ? "png" : kind === "audio" ? "wav" : "webm"}`, type: `${kind}/${kind === "image" ? "png" : kind === "audio" ? "wav" : "webm"}`, bytes: [...bytes] };
    await page.getByRole("tab", { name: kind[0].toUpperCase() + kind.slice(1), exact: true }).click();
    await drop(page, `${kind} drop area`, [file]);
    await expect(page.locator(".media-preview")).toContainText(file.name);
    await expect(page.locator(`.media-preview ${kind === "image" ? "img" : kind}`)).toBeVisible();
    await drop(page, `${kind} drop area`, [file, file]);
    await expect(page.locator(".media-input [role=alert]")).toContainText("one file");
    await drop(page, `${kind} drop area`, [{ name: "wrong.txt", type: "text/plain", bytes: [65] }]);
    await expect(page.locator(".media-input [role=alert]")).toContainText("Choose a");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
