// This worker only receives local file data. Model downloads contain no user media.
import browserModels from "../models/browser-models.json";
import type { MediaSegment } from "./media-types";
type MediaRequest = ({ kind: "image"; file: File } | { kind: "video"; audio: Float32Array } | { kind: "frames"; frames: { id: string; timestamp: number; file: File; width: number; height: number; scene_change: number }[] }) & { language: "en" | "hi" };
const report = (message: string) => self.postMessage({ status: "progress", message });

self.addEventListener("message", async (event: MessageEvent<MediaRequest>) => {
  try {
    if (event.data.kind === "frames") {
      const { createWorker } = await import("tesseract.js");
      const reader = await createWorker(event.data.language === "hi" ? "hin+eng" : "eng", 1);
      const frames = [];
      try {
        for (const [index, frame] of event.data.frames.entries()) {
          report(`Reading on-screen text in frame ${index + 1} of ${event.data.frames.length}…`);
          try {
            const output = await reader.recognize(frame.file);
            const text = output.data.text.trim().slice(0, 3000);
            frames.push({ id: frame.id, timestamp: frame.timestamp, width: frame.width, height: frame.height, scene_change: frame.scene_change, text, ocr_status: text ? "text_found" : "no_text" });
          } catch { frames.push({ id: frame.id, timestamp: frame.timestamp, width: frame.width, height: frame.height, scene_change: frame.scene_change, text: "", ocr_status: "failed" }); }
        }
      } finally { await reader.terminate(); }
      self.postMessage({ status: "frames_complete", frames });
      return;
    }
    let text: string;
    let segments: MediaSegment[] = [];
    let width: number | undefined, height: number | undefined;
    if (event.data.kind === "image") {
      report("Loading the text reader…");
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker(event.data.language === "hi" ? "hin+eng" : "eng", 1, {
        logger: (progress) => report(`${progress.status} · ${Math.round(progress.progress * 100)}%`),
      });
      try {
        const bitmap = await createImageBitmap(event.data.file);
        width = bitmap.width; height = bitmap.height; bitmap.close();
        const result = await worker.recognize(event.data.file, {}, { text: true, blocks: true });
        text = result.data.text;
        segments = (result.data.blocks || []).flatMap(block => block.paragraphs.flatMap(paragraph => paragraph.lines.map(line => ({ text: line.text.trim(), bbox: line.bbox, confidence: line.confidence })))).filter(line => line.text).slice(0, 150);
      } finally {
        await worker.terminate();
      }
    } else {
      report("Downloading the speech model. First use may take a few minutes…");
      const { pipeline, env } = await import("@huggingface/transformers");
      env.allowLocalModels = false;
      // One CPU thread also works on hosts without cross-origin isolation.
      if (env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1;
      const speechModel = event.data.language === "hi" ? browserModels.speech_hi : browserModels.speech_en;
      const transcriber = await pipeline("automatic-speech-recognition", speechModel.id, {
        revision: speechModel.revision,
        device: "wasm", dtype: "q8",
        progress_callback: (progress) => {
          if (progress.status === "progress") report(`Downloading speech model · ${Math.round(progress.progress)}% of ${progress.file}`);
        },
      });
      try {
        report("Transcribing speech on your device. Keep this tab open…");
        const output = await transcriber(event.data.audio, { chunk_length_s: 20, stride_length_s: 3, return_timestamps: true, ...(event.data.language === "hi" ? { language: "hindi", task: "transcribe" } : {}) });
        text = (Array.isArray(output) ? output.map(item => item.text).join(" ") : output.text);
        const chunks = (Array.isArray(output) ? output.flatMap(item => item.chunks || []) : output.chunks || []);
        segments = chunks.map(chunk => ({ text: chunk.text, start: chunk.timestamp[0] ?? undefined, end: chunk.timestamp[1] }));
      } finally {
        await transcriber.dispose();
      }
    }
    text = text.trim();
    if (!text) throw new Error("No readable text or speech was found. Try a clearer file or paste the words manually.");
    self.postMessage({ status: "complete", text: text.slice(0, 20000), segments, width, height, truncated: text.length > 20000 });
  } catch (error) {
    self.postMessage({ status: "error", message: error instanceof Error ? error.message : "Media extraction failed." });
  }
});
