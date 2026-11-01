"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Download, ExternalLink, LoaderCircle, Plus, Search, Trash2 } from "lucide-react";

import { reserveBrowserModel } from "./worker-budget";

type Source = { title: string; publisher: string; url: string | null; published_date?: string | null; truncated: boolean };
type Passage = { id: string; text: string; start: number; end: number; retrieval_score: number };
type Finding = "unreviewed" | "supports" | "contradicts" | "insufficient";
type Citation = Passage & { citationId: string; source: Source; retrieved_at: string; finding: Finding; note: string; relation?: string; similarity?: number; probabilities?: { label: string; score: number }[] };
type Result = { source: Source; passages: Passage[]; retrieved_at: string };
type Suggestion = { id: string; relation: string; similarity: number; probabilities: { label: string; score: number }[] };
const relationLabels: Record<string, string> = { suggested_support: "Model suggests textual support", suggested_contradiction: "Model suggests textual contradiction", unclear: "Model comparison is inconclusive" };

export default function Investigation({ claim, sources = [], active = true }: { active?: boolean; claim: string; sources?: { url: string; title: string }[] }) {
  const [sourceMode, setSourceMode] = useState<"url" | "text">("url");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [busy, setBusy] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [keywords, setKeywords] = useState(claim);
  const [coverage, setCoverage] = useState<{ message: string; results: { url: string; title: string; publisher: string; indexed_at: string }[] } | null>(null);
  const [coverageBusy, setCoverageBusy] = useState(false);
  const coverageRef = useRef<AbortController | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const requestRef = useRef<AbortController | null>(null);
  const releaseRef = useRef<(() => void) | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sequenceRef = useRef(0);
  function stopComparison() { releaseRef.current?.(); releaseRef.current = null; workerRef.current?.terminate(); workerRef.current = null; if (timerRef.current) clearTimeout(timerRef.current); timerRef.current = null; }
  useEffect(() => {
    sequenceRef.current++;
    requestRef.current?.abort(); coverageRef.current?.abort(); stopComparison();
    setCitations([]); setBusy(false); setComparing(false); setProgress(""); setError(""); setMessage(""); setModels([]); setKeywords(claim); setCoverage(null); setCoverageBusy(false);
    return () => { requestRef.current?.abort(); coverageRef.current?.abort(); stopComparison(); };
  }, [claim]);
  useEffect(() => { if (!active) { stopComparison(); setComparing(false); setProgress(""); } }, [active]);
  const support = citations.filter(item => item.finding === "supports").length;
  const contradiction = citations.filter(item => item.finding === "contradicts").length;
  const linkedDomains = new Set(citations.flatMap(item => item.source.url ? [new URL(item.source.url).hostname] : []));
  const assessment = support && contradiction ? "Conflicting reader assessments" : support ? "Reader assessment: supporting evidence" : contradiction ? "Reader assessment: contradicting evidence" : "Insufficient reviewed evidence";

  async function retrieve() {
    const controller = new AbortController(); requestRef.current = controller;
    const sequence = sequenceRef.current;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/evidence", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: claim, ...(sourceMode === "url" ? { url: sourceUrl } : { text: sourceText }) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : "Please check the source and try again.");
      if (sequence !== sequenceRef.current || controller.signal.aborted) return;
      const data = result as Result;
      if (!data.passages.length) setMessage("No passages shared enough query words. Try another source or refine the claim; this does not establish truth or falsehood.");
      setCitations(current => {
        const next = [...current];
        for (const item of data.passages) {
          const citationId = `${data.source.url || "pasted"}:${item.id}`;
          if (!next.some(existing => existing.citationId === citationId)) next.push({ ...item, citationId, source: data.source, retrieved_at: data.retrieved_at, finding: "unreviewed", note: "" });
        }
        return next.slice(0, 16);
      });
      if (citations.length + data.passages.length > 16) setMessage("The notebook holds up to 16 passages. Remove older passages to add more.");
    } catch (error) { if (!controller.signal.aborted) setError((error as Error).message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function discover() {
    const controller = new AbortController(); coverageRef.current?.abort(); coverageRef.current = controller;
    setCoverageBusy(true); setCoverage(null);
    try {
      const response = await fetch("/api/coverage", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: keywords }) });
      if (!response.ok) throw new Error("Search failed");
      const result = await response.json();
      if (!controller.signal.aborted) setCoverage(result);
    } catch { if (!controller.signal.aborted) setCoverage({ message: "Recent coverage search is unavailable. Add a public source or paste its text instead.", results: [] }); }
    finally { if (!controller.signal.aborted) setCoverageBusy(false); }
  }
  function compare() {
    const job = sequenceRef.current;
    stopComparison();
    const release = reserveBrowserModel();
    if (!release) { setError("Another model is processing on this page. Wait or cancel that job first."); return; }
    releaseRef.current = release;
    setComparing(true); setError(""); setProgress("Starting local model comparison…");
    try {
      const worker = new Worker(new URL("./evidence.worker.ts", import.meta.url), { type: "module" }); workerRef.current = worker;
      const fail = (message: string) => { stopComparison(); setComparing(false); setProgress(""); setError(message); };
      timerRef.current = setTimeout(() => fail("The model download or comparison timed out. Your citations are preserved; you can review them manually."), 10 * 60 * 1000);
      worker.onmessage = ({ data }) => {
        if (job !== sequenceRef.current) return;
        if (data.status === "progress") setProgress(data.message);
        else if (data.status === "complete") {
          setCitations(current => current.map(item => { const result = (data.results as Suggestion[]).find(value => value.id === item.citationId); return result ? { ...item, relation: result.relation, similarity: result.similarity, probabilities: result.probabilities } : item; }));
          setModels(data.models); setProgress(""); setComparing(false); stopComparison();
        } else fail("Comparison unavailable. Check your connection or device memory. Your passages remain available for manual review.");
      };
      worker.onerror = event => { event.preventDefault(); fail("The local comparison worker could not start. You can still review and export your citations."); };
      worker.postMessage({ claim, passages: citations.map(item => ({ id: item.citationId, text: item.text })) });
    } catch { stopComparison(); setComparing(false); setError("This browser could not start model comparison. Review the passages manually."); }
  }
  function update(id: string, value: Partial<Citation>) { setCitations(current => current.map(item => item.citationId === id ? { ...item, ...value } : item)); }
  function exportReport() {
    const report = { schema_version: 2, claim_verification: { assessment: support && contradiction ? "MIXED" : support ? "SUPPORTED" : contradiction ? "REFUTED" : "INSUFFICIENT_EVIDENCE", assessment_author: "reader", confidence: null }, created_at: new Date().toISOString(), claim, assessment, assessment_author: "reader", citations, comparison_models: models, limitations: ["Reader annotations and model text-relation suggestions are not independent fact verification.", "Lexical retrieval and semantic similarity measure relevance, not source reliability.", "Pasted sources are not authenticated. Multiple passages may come from one source."] };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "verity-investigation.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const english = !/[\u0900-\u097f]/.test(claim);
  return <section className="card investigation-card" aria-label="Evidence notebook">
    <div className="card-header"><div><BookOpen size={20} /><h2>Build an evidence notebook</h2></div></div>
    <p className="section-description">Investigate the selected claim with exact source passages. Check dates, names, location, and independent reporting. Model suggestions never change the article classifier’s result.</p>
    <blockquote className="investigation-claim">{claim || "Choose a claim above to begin."}</blockquote>
    <p className="assessment" aria-live="polite">{assessment}</p>{citations.length > 0 && <p className="section-description">{citations.length} passages · {linkedDomains.size} linked source domains. Multiple passages from one domain are not independent corroboration.</p>}
    <details className="coverage-discovery"><summary>Discover recent news sources</summary><p className="field-help">Search recent coverage using a few topic keywords. This sends your query to GDELT, a third-party news index. Results are source leads, not fact-checks, and cover a recent window rather than the entire web.</p><form onSubmit={event => { event.preventDefault(); void discover(); }}><label htmlFor="coverage-keywords">News search keywords</label><input id="coverage-keywords" minLength={8} maxLength={300} required value={keywords} onChange={event => { coverageRef.current?.abort(); setCoverageBusy(false); setKeywords(event.target.value); setCoverage(null); }} /><button className="secondary-button" disabled={coverageBusy}>{coverageBusy ? <LoaderCircle className="spin" size={15} /> : <Search size={15} />}Search recent coverage</button></form>{coverage && <div role="status"><p className="field-help">{coverage.message}</p>{coverage.results.map(item => <article className="coverage-result" key={item.url}><a className="text-link" href={item.url} target="_blank" rel="noreferrer">{item.title} <ExternalLink size={13} /></a><p className="field-help">{item.publisher} · Index timestamp: {item.indexed_at || "Unknown"}</p><button className="secondary-button" onClick={() => { setSourceMode("url"); setSourceUrl(item.url); setTimeout(() => document.getElementById("evidence-url")?.focus(), 0); }}>Use this source</button></article>)}</div>}</details>
    {sources.length > 0 && <div className="source-shortcuts">{sources.slice(0, 5).map(item => <button className="secondary-button" key={item.url} onClick={() => { setSourceMode("url"); setSourceUrl(item.url); }}><Plus size={14} />Inspect: {item.title.slice(0, 65)}</button>)}</div>}
    <div className="notebook-tabs"><button aria-pressed={sourceMode === "url"} onClick={() => setSourceMode("url")}>Public source URL</button><button aria-pressed={sourceMode === "text"} onClick={() => setSourceMode("text")}>Paste source text</button></div>
    <form onSubmit={event => { event.preventDefault(); void retrieve(); }} className="notebook-form">
      {sourceMode === "url" ? <><label htmlFor="evidence-url">Evidence source URL</label><input id="evidence-url" type="url" required maxLength={2048} value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} placeholder="https://original-source.example/report" /></> : <><label htmlFor="evidence-text">Evidence source text</label><textarea id="evidence-text" required minLength={40} maxLength={20000} value={sourceText} onChange={event => setSourceText(event.target.value)} placeholder="Paste the source passage with enough surrounding context…" /><p className="field-help">Pasted text has no authenticated publisher or citation URL.</p></>}
      <button className="primary-button" disabled={busy || comparing || claim.trim().length < 8 || citations.length >= 16}>{busy ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />}Find source passages</button>
    </form>
    {error && <p role="alert" className="error-message">{error}</p>}{message && <p role="status" className="field-help notebook-message">{message}</p>}
    {citations.length > 0 && <><div className="notebook-tools"><button className="secondary-button" disabled={comparing || busy || !english} onClick={compare}>{comparing ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />}Compare evidence with AI</button>{comparing && <button className="secondary-button" onClick={() => { stopComparison(); setComparing(false); setProgress(""); }}>Cancel comparison</button>}<button className="secondary-button" onClick={exportReport}><Download size={16} />Export evidence report</button></div><p className="section-description">Optional English-only AI assistance downloads models and runs locally. It compares wording, not source credibility or factual truth. Up to four semantically ranked passages are compared. {english ? "" : "Hindi evidence can be reviewed manually; the English AI comparison is disabled."}</p>{progress && <p className="section-description" role="status">{progress}</p>}<div className="citation-list">{citations.map((item, index) => <article className="citation" key={item.citationId}><div className="citation-heading"><strong>[{index + 1}] {item.source.title}</strong><button className="icon-button" disabled={comparing} aria-label={`Remove citation ${index + 1}`} onClick={() => setCitations(current => current.filter(value => value.citationId !== item.citationId))}><Trash2 size={16} /></button></div><p className="field-help">{item.source.publisher} · Published: {item.source.published_date || "Unknown"} · Retrieved: {item.retrieved_at.slice(0, 10)}{item.source.truncated ? " · Source shortened" : ""}</p><blockquote>{item.text}</blockquote>{item.source.url && <a className="text-link" href={item.source.url} target="_blank" rel="noreferrer">Open original source <ExternalLink size={14} /></a>}{item.relation && <p className="model-relation">{relationLabels[item.relation]} · experimental English model</p>}<label htmlFor={`finding-${index}`}>Your assessment of this passage</label><select id={`finding-${index}`} value={item.finding} onChange={event => update(item.citationId, { finding: event.target.value as Finding })}><option value="unreviewed">Not reviewed</option><option value="supports">Supports the selected claim</option><option value="contradicts">Contradicts the selected claim</option><option value="insufficient">Insufficient or unrelated</option></select><label htmlFor={`note-${index}`}>Your reasoning and context</label><textarea id={`note-${index}`} maxLength={1000} value={item.note} onChange={event => update(item.citationId, { note: event.target.value })} placeholder="Explain your assessment, including date and context…" /><p className="print-only">Passage annotation: {item.finding}. {item.note || "No additional reader reasoning recorded."}</p></article>)}</div></>}
    <p className="section-description">This notebook lasts for this page session. Export it before leaving. Changing the selected claim clears its citations and assessments.</p>
  </section>;
}
