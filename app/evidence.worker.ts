// Optional English semantic retrieval and textual-entailment assistance.
// A relation between two texts does not authenticate a source or establish truth.
import { pipeline, AutoTokenizer, AutoModelForSequenceClassification, env } from "@huggingface/transformers";

import browserModels from "../models/browser-models.json";

type Passage = { id: string; text: string };
self.addEventListener("message", async ({ data }: MessageEvent<{ claim: string; passages: Passage[] }>) => {
  const progress = (message: string) => self.postMessage({ status: "progress", message });
  env.allowLocalModels = false;
  if (env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1;
  try {
    progress("Loading the English semantic search model…");
    const embed = await pipeline("feature-extraction", browserModels.semantic.id, { revision: browserModels.semantic.revision, device: "wasm", dtype: "q8" });
    let ranked: (Passage & { similarity: number })[];
    try {
      const output = await embed([data.claim, ...data.passages.map(item => item.text)], { pooling: "mean", normalize: true });
      const vectors = output.tolist() as number[][];
      ranked = data.passages.map((item, index) => ({ ...item, similarity: vectors[0].reduce((sum, value, i) => sum + value * vectors[index + 1][i], 0) })).sort((a, b) => b.similarity - a.similarity);
    } finally { await embed.dispose(); }
    progress("Loading the English evidence-comparison model…");
    const name = browserModels.nli.id;
    const tokenizer = await AutoTokenizer.from_pretrained(name, { revision: browserModels.nli.revision });
    const model = await AutoModelForSequenceClassification.from_pretrained(name, { revision: browserModels.nli.revision, device: "wasm", dtype: "q8" });
    try {
      const results = [];
      for (const [index, item] of ranked.slice(0, 4).entries()) {
        progress(`Comparing passage ${index + 1} of ${Math.min(4, ranked.length)}…`);
        const inputs = tokenizer(item.text, { text_pair: data.claim, truncation: true, max_length: 384, padding: true });
        const output = await model(inputs);
        const logits = Array.from(output.logits.data as Float32Array);
        const max = Math.max(...logits);
        const exp = logits.map(value => Math.exp(value - max));
        const total = exp.reduce((a, b) => a + b, 0);
        const labels = (model.config as unknown as { id2label: Record<string, string> }).id2label;
        const probabilities = exp.map((value, i) => ({ label: labels[String(i)].toLowerCase(), score: value / total })).sort((a, b) => b.score - a.score);
        const top = probabilities[0];
        const strong = top.score >= .8 && top.score - probabilities[1].score >= .2;
        const relation = strong && top.label.includes("entail") ? "suggested_support" : strong && top.label.includes("contradict") ? "suggested_contradiction" : "unclear";
        results.push({ id: item.id, similarity: item.similarity, relation, probabilities });
      }
      self.postMessage({ status: "complete", results, models: [`${browserModels.semantic.id}@${browserModels.semantic.revision}`, `${name}@${browserModels.nli.revision}`] });
    } finally { await model.dispose(); }
  } catch (error) {
    self.postMessage({ status: "error", message: error instanceof Error ? error.message : "The comparison models could not run." });
  }
});
