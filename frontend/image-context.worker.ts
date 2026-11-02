import { pipeline, RawImage, env } from "@huggingface/transformers";
import browserModels from "../models/browser-models.json";
self.addEventListener("message", async ({ data }: MessageEvent<{ file: File; captions: string[] }>) => {
  try {
    env.allowLocalModels = false;
    if (env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1;
    self.postMessage({ status: "progress", message: "Downloading the visual-language model. First use can take several minutes…" });
    const classifier = await pipeline("zero-shot-image-classification", browserModels.visual.id, { revision: browserModels.visual.revision, device: "wasm", dtype: "q8" });
    try {
      self.postMessage({ status: "progress", message: "Comparing the image with your descriptions locally…" });
      const image = await RawImage.fromBlob(data.file);
      const results = await classifier(image, data.captions);
      self.postMessage({ status: "complete", results, model: browserModels.visual.id, revision: browserModels.visual.revision });
    } finally { await classifier.dispose(); }
  } catch (error) { self.postMessage({ status: "error", message: error instanceof Error ? error.message : "Image comparison failed." }); }
});
