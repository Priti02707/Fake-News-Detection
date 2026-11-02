"use client";
import { useEffect, useState } from "react";

export default function ClassificationDashboard({ onChoose }: { onChoose: (mode: "text" | "url" | "image" | "video" | "audio") => void }) {
  const [classification, setClassification] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v2/capabilities", { signal: controller.signal }).then(async response => { if (!response.ok) throw new Error("Capabilities could not be loaded."); return response.json(); }).then(result => { if (!result.classification) throw new Error("The API did not report classifier availability."); setClassification(result.classification); setError(""); }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [attempt]);
  return <section className="classification-dashboard" aria-label="Classification dashboard"><div className="eyebrow">FAKE NEWS DETECTION WORKSPACE</div><h2>Choose what you want to analyze.</h2><p>Get a Fake, Real or Uncertain prediction for supported English article text. Media tools add context; full-media models require separate training and evaluation.</p>{error ? <p role="alert">{error} <button className="text-link" onClick={() => setAttempt(value => value + 1)}>Retry model availability</button></p> : !classification ? <p role="status">Loading model availability…</p> : <div className="classification-options">{(["text", "image", "video", "audio", "url"] as const).map(mode => <button key={mode} onClick={() => onChoose(mode)}><strong>{mode === "url" ? "News URL" : mode[0].toUpperCase() + mode.slice(1)} detection</strong><span>{classification[mode]}</span></button>)}</div>}<p className="field-help">No full-media, acoustic, Hindi-veracity or deepfake detector is advertised as evaluated. Evidence investigation remains an optional step after classification.</p></section>;
}
