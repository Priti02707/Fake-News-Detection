"use client";
import { useEffect, useId, useRef, useState } from "react";
import { ExternalLink, LoaderCircle, ScanLine } from "lucide-react";

import type { VisualComparison } from "./media-types";
import { reserveBrowserModel } from "./worker-budget";
import { reviewVisual, type MediaEvidenceContext } from "./multimodal";

export default function ImageContext({ file, onObserved, onInvestigate, timestamp }: { file: File; onObserved?: (value: VisualComparison | null) => void; onInvestigate?: (claim: string, context: MediaEvidenceContext) => void; timestamp?: number }) {
  const id = useId();
  const [caption, setCaption] = useState("");
  const [alternative, setAlternative] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<{ label: string; score: number }[]>([]);
  const [comparison, setComparison] = useState<VisualComparison | null>(null);
  const releaseRef = useRef<(() => void) | null>(null);
  const worker = useRef<Worker | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function stop() { releaseRef.current?.(); releaseRef.current = null; worker.current?.terminate(); worker.current = null; if (timer.current) clearTimeout(timer.current); timer.current = null; }
  useEffect(() => { setResults([]); setComparison(null); setCaption(""); setAlternative(""); setMessage(""); setBusy(false); return stop; }, [file]);
  function compare() {
    stop();
    const release = reserveBrowserModel();
    if (!release) { setMessage("Another model is processing on this page. Wait or cancel that job first."); return; }
    releaseRef.current = release;
    setBusy(true); setResults([]); setComparison(null); onObserved?.(null); setMessage("Starting the visual-language reader…");
    const fail = () => { stop(); setBusy(false); setMessage("The visual comparison could not finish. Check your connection or device memory. No authenticity conclusion was made."); };
    try {
      const instance = new Worker(new URL("./image-context.worker.ts", import.meta.url), { type: "module" }); worker.current = instance;
      timer.current = setTimeout(fail, 10 * 60 * 1000);
      instance.onmessage = ({ data }) => { if (data.status === "progress") setMessage(data.message); else if (data.status === "complete") { const observed = { model: data.model, revision: data.revision, matches: data.results, claim: caption.trim(), alternative: alternative.trim(), scope: "Relative visual match among supplied descriptions; not factual truth, date, location, or authenticity" }; setResults(data.results); setComparison(observed); onObserved?.(observed); setMessage("Relative visual match between these two descriptions only. These scores are not probabilities of truth."); setBusy(false); stop(); } else fail(); };
      instance.onerror = event => { event.preventDefault(); fail(); };
      instance.postMessage({ file, captions: [caption.trim(), alternative.trim()] });
    } catch { fail(); }
  }
  return <details className="image-context"><summary>Explore image context (experimental)</summary><h4>Image–news mismatch review</h4><p className="field-help">Enter the associated headline or caption, then an alternative visual description. Compare these two English descriptions with CLIP on your device. It can assess visual resemblance, but cannot establish the event, date, location, image authenticity, or factual truth. First use downloads a large model.</p><label htmlFor={`${id}-caption`}>Description to investigate</label><input id={`${id}-caption`} maxLength={200} value={caption} disabled={busy} onChange={event => { setCaption(event.target.value); setResults([]); setComparison(null); onObserved?.(null); setMessage(""); }} placeholder="A bridge over a river after flooding" /><label htmlFor={`${id}-alternative`}>Alternative description</label><input id={`${id}-alternative`} maxLength={200} value={alternative} disabled={busy} onChange={event => { setAlternative(event.target.value); setResults([]); setComparison(null); onObserved?.(null); setMessage(""); }} placeholder="A road through a dry landscape" /><button className="secondary-button" disabled={busy || caption.trim().length < 5 || alternative.trim().length < 5 || caption.trim().toLowerCase() === alternative.trim().toLowerCase()} onClick={compare}>{busy ? <LoaderCircle className="spin" size={15} /> : <ScanLine size={15} />}Compare image descriptions</button>{busy && <button className="text-link" onClick={() => { stop(); setBusy(false); setMessage("Visual comparison cancelled."); }}>Cancel visual comparison</button>}{message && <p role="status" className="field-help">{message}</p>}{results.map(item => <div className="visual-match" key={item.label}><span>{item.label}</span><strong>{(item.score * 100).toFixed(1)}% relative match</strong></div>)}{comparison && <div className="visual-review" data-review-status={reviewVisual(comparison).status}><strong>{reviewVisual(comparison).status === "potential_mismatch" ? "Potential image–caption mismatch to investigate" : reviewVisual(comparison).status === "no_relative_mismatch" ? "No relative mismatch in this comparison" : "Visual comparison inconclusive"}</strong><p>{reviewVisual(comparison).explanation}</p><p className="field-help">Review rule: a relative-score margin of 0.2 between two reader-supplied descriptions. This heuristic has no validated factual accuracy.</p></div>}{onInvestigate && <button className="secondary-button" disabled={busy || caption.trim().length < 8} onClick={() => onInvestigate(caption.trim(), { filename: file.name, kind: timestamp === undefined ? "image" : "video", channel: "caption", ...(timestamp === undefined ? {} : { timestamp }), visual_review: reviewVisual(comparison), ...(comparison ? { visual_comparison: comparison } : {}) })}>Investigate this image claim</button>}<p className="field-help">Investigating sends your caption to GDELT and retrieves up to two public source pages through the server. It cannot identify the original photograph or verify its context automatically.</p><p className="field-help">For earlier appearances, use a reverse-image search and compare source dates yourself. Uploading to that service shares the image with its provider.</p><a className="text-link" href="https://lens.google/" target="_blank" rel="noreferrer">Open Google Lens manually <ExternalLink size={13} /></a></details>;
}
