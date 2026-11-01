// This worker only receives local file data. Model downloads contain no user media.
type MediaRequest = { kind: "image"; file: File } | { kind: "video"; audio: Float32Array };
const report = (message: string) => self.postMessage({ status: "progress", message });

self.addEventListener("message", async (event: MessageEvent<MediaRequest>) => {
  try {
    let text: string;
    if (event.data.kind === "image") {
      report("Loading the English text reader…");
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: (progress) => report(`${progress.status} · ${Math.round(progress.progress * 100)}%`),
      });
      try {
        const result = await worker.recognize(event.data.file);
        text = result.data.text;
      } finally {
        await worker.terminate();
      }
    } else {
      report("Downloading the English speech model. First use may take a few minutes…");
      const { pipeline, env } = await import("@huggingface/transformers");
      env.allowLocalModels = false;
      // One CPU thread also works on hosts without cross-origin isolation.
      if (env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1;
      const transcriber = await pipeline("automatic-speech-recognition", "onnx-community/whisper-tiny.en", {
        device: "wasm", dtype: "q8",
        progress_callback: (progress) => {
          if (progress.status === "progress") report(`Downloading speech model · ${Math.round(progress.progress)}% of ${progress.file}`);
        },
      });
      try {
        report("Transcribing speech on your device. Keep this tab open…");
        const output = await transcriber(event.data.audio, { chunk_length_s: 20, stride_length_s: 3 });
        text = (Array.isArray(output) ? output.map(item => item.text).join(" ") : output.text);
      } finally {
        await transcriber.dispose();
      }
    }
    text = text.trim();
    if (!text) throw new Error("No readable English text or speech was found. Try a clearer file or paste the words manually.");
    self.postMessage({ status: "complete", text: text.slice(0, 20000), truncated: text.length > 20000 });
  } catch (error) {
    self.postMessage({ status: "error", message: error instanceof Error ? error.message : "Media extraction failed." });
  }
});
