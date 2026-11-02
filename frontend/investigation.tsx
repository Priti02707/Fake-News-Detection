"use client";

import { useEffect, useId, useRef, useState } from "react";
import { BookOpen, Download, ExternalLink, LoaderCircle, Plus, Search, Trash2 } from "lucide-react";

import { reserveBrowserModel } from "./worker-budget";
import type { MediaEvidenceContext } from "./multimodal";

type Source = { title: string; publisher: string; url: string | null; published_date?: string | null; truncated: boolean };
type Passage = { id: string; text: string; start: number; end: number; retrieval_score: number };
type Finding = "unreviewed" | "supports" | "contradicts" | "insufficient";
type DateContext = { status: string; message: string; age_days: number | null; review_window_days: number; checked_at: string };
type Citation = Passage & { citationId: string; source: Source; retrieved_at: string; date_context?: DateContext; finding: Finding; note: string; relation?: string; similarity?: number; probabilities?: { label: string; score: number }[] };
type Result = { source: Source; passages: Passage[]; retrieved_at: string; date_context?: DateContext };
type Suggestion = { id: string; relation: string; similarity: number; probabilities: { label: string; score: number }[] };
const relationLabels: Record<string, string> = { suggested_support: "Model suggests textual support", suggested_contradiction: "Model suggests textual contradiction", unclear: "Model comparison is inconclusive" };

export default function Investigation({ claim, sources = [], active = true, context, autoDiscover = false }: { active?: boolean; claim: string; sources?: { url: string; title: string }[]; context?: MediaEvidenceContext; autoDiscover?: boolean }) {
  const id = useId();
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
  const [provider, setProvider] = useState<"news" | "fact_checks">("news");
  const [coverage, setCoverage] = useState<{ message: string; search_url?: string; results: { url: string; title: string; publisher: string; indexed_at?: string; date?: string; rating?: string }[] } | null>(null);
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
  }, [claim, context]);
  useEffect(() => { if (!active) { requestRef.current?.abort(); coverageRef.current?.abort(); stopComparison(); setBusy(false); setCoverageBusy(false); setComparing(false); setProgress(""); } }, [active]);
  const support = citations.filter(item => item.finding === "supports").length;
  const contradiction = citations.filter(item => item.finding === "contradicts").length;
  const linkedDomains = new Set(citations.flatMap(item => item.source.url ? [new URL(item.source.url).hostname] : []));
  const assessment = support && contradiction ? "Conflicting reader assessments" : support ? "Reader assessment: supporting evidence" : contradiction ? "Reader assessment: contradicting evidence" : "Insufficient reviewed evidence";

  function addEvidence(data: Result) {
    setCitations(current => {
      const next = [...current];
      for (const item of data.passages) {
        const citationId = `${data.source.url || "pasted"}:${item.id}`;
        if (!next.some(existing => existing.citationId === citationId)) next.push({ ...item, citationId, source: data.source, retrieved_at: data.retrieved_at, date_context: data.date_context, finding: "unreviewed", note: "" });
      }
      return next.slice(0, 16);
    });
  }
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
      addEvidence(data);
      if (citations.length + data.passages.length > 16) setMessage("The notebook holds up to 16 passages. Remove older passages to add more.");
    } catch (error) { if (!controller.signal.aborted) setError((error as Error).message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function discover(searchQuery = keywords, gather = false) {
    const controller = new AbortController(); coverageRef.current?.abort(); coverageRef.current = controller;
    setCoverageBusy(true); setCoverage(null);
    try {
      const response = await fetch(provider === "news" ? "/api/coverage" : "/api/fact-check", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: searchQuery, language: /[\u0900-\u097f]/.test(searchQuery) ? "hi" : "en" }) });
      if (!response.ok) throw new Error("Search failed");
      const result = await response.json();
      if (!controller.signal.aborted) setCoverage(result);
      if (gather && !controller.signal.aborted) {
        let gathered = 0, failed = 0;
        const urls = [...new Set((result.results || []).map((item: { url: string }) => item.url))].slice(0, 2);
        for (const url of urls) {
          if (controller.signal.aborted) break;
          try {
            const response = await fetch("/api/evidence", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: searchQuery, url }) });
            if (!response.ok) { failed++; continue; }
            const data = await response.json() as Result;
            if (!controller.signal.aborted) { addEvidence(data); gathered += data.passages.length; }
          } catch { if (!controller.signal.aborted) failed++; }
        }
        if (!controller.signal.aborted && urls.length) setMessage(`${gathered} relevant passages gathered for review.${failed ? " Some sources could not be read; add another source manually." : ""} Check dates, independence and whether each passage addresses the same claim. No factual verdict was inferred.`);
      }
    } catch { if (!controller.signal.aborted) setCoverage({ message: "Recent coverage search is unavailable. Add a public source or paste its text instead.", results: [] }); }
    finally { if (!controller.signal.aborted) setCoverageBusy(false); }
  }
  // Selecting a new media observation starts one bounded search. Editing the
  // claim cancels it; subsequent searches require the explicit search control.
  useEffect(() => { if (autoDiscover && context && claim.trim().length >= 8) void discover(claim, true); }, [context, autoDiscover]);
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
  function printEvidence() {
    if (context) document.body.dataset.mediaEvidencePrint = "true";
    try { window.print(); } finally { delete document.body.dataset.mediaEvidencePrint; }
  }
  function exportReport() {
    const report = { schema_version: 2, claim_verification: { assessment: support && contradiction ? "MIXED" : support ? "SUPPORTED" : contradiction ? "REFUTED" : "INSUFFICIENT_EVIDENCE", assessment_author: "reader", confidence: null }, created_at: new Date().toISOString(), media_context: context || null, automated_factual_assessment: "INSUFFICIENT_EVIDENCE", claim, assessment, assessment_author: "reader", citations, comparison_models: models, limitations: ["Reader annotations and model text-relation suggestions are not independent fact verification.", "Lexical retrieval and semantic similarity measure relevance, not source reliability.", "Pasted sources are not authenticated. Multiple passages may come from one source.", "Media comparison and timeline flags are review heuristics, not verified factual conclusions."] };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "verity-investigation.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const english = !/[\u0900-\u097f]/.test(claim);
  return <section className="card investigation-card" aria-label="Evidence notebook">
    <div className="card-header"><div><BookOpen size={20} /><h2>Build an evidence notebook</h2></div></div>
    <p className="section-description">Investigate the selected claim with exact source passages. Check dates, names, location, and independent reporting. Model suggestions never change the article classifier’s result.</p>
    {context && <p className="media-evidence-origin">Media source: {context.filename} · {context.channel}{context.timestamp !== undefined ? ` · ${context.timestamp.toFixed(1)} seconds` : ""}. Sources must address this claim and its event, date and location.</p>}<blockquote className="investigation-claim">{claim || "Choose a claim above to begin."}</blockquote>
    <p className="assessment" aria-live="polite">{assessment}</p>{citations.length > 0 && <p className="section-description">{citations.length} passages · {linkedDomains.size} linked source domains. Multiple passages from one domain are not independent corroboration.</p>}
    <details className="coverage-discovery" open={autoDiscover || undefined}><summary>Discover recent news sources</summary><p className="field-help">Search recent coverage using a few topic keywords. This sends your query to GDELT, a third-party news index. Results are source leads, not fact-checks, and cover a recent window rather than the entire web.</p><label htmlFor={`${id}-provider`}>Evidence search provider</label><select id={`${id}-provider`} disabled={coverageBusy} value={provider} onChange={event => { setProvider(event.target.value as "news" | "fact_checks"); setCoverage(null); }}><option value="news">Recent news leads (GDELT)</option><option value="fact_checks">Published fact-checks (Google, optional)</option></select><p className="field-help">News leads are not independent corroboration until you inspect their provenance. Published reviews retain the publisher’s rating; no rating is treated as this app’s verdict.</p><form onSubmit={event => { event.preventDefault(); void discover(); }}><label htmlFor={`${id}-coverage-keywords`}>News search keywords</label><input id={`${id}-coverage-keywords`} minLength={8} maxLength={300} required value={keywords} onChange={event => { coverageRef.current?.abort(); setCoverageBusy(false); setKeywords(event.target.value); setCoverage(null); }} /><button className="secondary-button" disabled={coverageBusy}>{coverageBusy ? <LoaderCircle className="spin" size={15} /> : <Search size={15} />}Search recent coverage</button>{coverageBusy && <button type="button" className="text-link" onClick={() => { coverageRef.current?.abort(); setCoverageBusy(false); }}>Cancel source gathering</button>}</form>{coverage && <div role="status"><p className="field-help">{coverage.message}</p>{coverage.search_url && <a className="text-link" href={coverage.search_url} target="_blank" rel="noreferrer">Search published fact-checks manually</a>}{coverage.results.map(item => <article className="coverage-result" key={item.url}><a className="text-link" href={item.url} target="_blank" rel="noreferrer">{item.title} <ExternalLink size={13} /></a><p className="field-help">{item.publisher} · {item.rating ? `Publisher rating: ${item.rating} · Published: ${item.date?.slice(0, 10) || "Unknown"}` : `Index timestamp: ${item.indexed_at || "Unknown"}`}</p><button className="secondary-button" onClick={() => { setSourceMode("url"); setSourceUrl(item.url); setTimeout(() => document.getElementById(`${id}-evidence-url`)?.focus(), 0); }}>Use this source</button></article>)}</div>}</details>
    {sources.length > 0 && <div className="source-shortcuts">{sources.slice(0, 5).map(item => <button className="secondary-button" key={item.url} onClick={() => { setSourceMode("url"); setSourceUrl(item.url); }}><Plus size={14} />Inspect: {item.title.slice(0, 65)}</button>)}</div>}
    <div className="notebook-tabs"><button aria-pressed={sourceMode === "url"} onClick={() => setSourceMode("url")}>Public source URL</button><button aria-pressed={sourceMode === "text"} onClick={() => setSourceMode("text")}>Paste source text</button></div>
    <form onSubmit={event => { event.preventDefault(); void retrieve(); }} className="notebook-form">
      {sourceMode === "url" ? <><label htmlFor={`${id}-evidence-url`}>Evidence source URL</label><input id={`${id}-evidence-url`} type="url" required maxLength={2048} value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} placeholder="https://original-source.example/report" /></> : <><label htmlFor={`${id}-evidence-text`}>Evidence source text</label><textarea id={`${id}-evidence-text`} required minLength={40} maxLength={20000} value={sourceText} onChange={event => setSourceText(event.target.value)} placeholder="Paste the source passage with enough surrounding context…" /><p className="field-help">Pasted text has no authenticated publisher or citation URL.</p></>}
      <button className="primary-button" disabled={busy || comparing || coverageBusy || claim.trim().length < 8 || citations.length >= 16}>{busy ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />}Find source passages</button>
    </form>
    {error && <p role="alert" className="error-message">{error}</p>}{message && <p role="status" className="field-help notebook-message">{message}</p>}
    {citations.length > 0 && <><div className="notebook-tools"><button className="secondary-button" disabled={comparing || busy || !english} onClick={compare}>{comparing ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />}Compare evidence with AI</button>{comparing && <button className="secondary-button" onClick={() => { stopComparison(); setComparing(false); setProgress(""); }}>Cancel comparison</button>}<button className="secondary-button" onClick={exportReport}><Download size={16} />Export evidence report</button><button className="secondary-button" onClick={printEvidence}>Print evidence / save PDF</button></div><p className="section-description">Optional English-only AI assistance downloads models and runs locally. It compares wording, not source credibility or factual truth. Up to four semantically ranked passages are compared. {english ? "" : "Hindi evidence can be reviewed manually; the English AI comparison is disabled."}</p>{progress && <p className="section-description" role="status">{progress}</p>}<div className="citation-list">{citations.map((item, index) => <article className="citation" key={item.citationId}><div className="citation-heading"><strong>[{index + 1}] {item.source.title}</strong><button className="icon-button" disabled={comparing} aria-label={`Remove citation ${index + 1}`} onClick={() => setCitations(current => current.filter(value => value.citationId !== item.citationId))}><Trash2 size={16} /></button></div><p className="field-help">{item.source.publisher} · Published: {item.source.published_date || "Unknown"} · Retrieved: {item.retrieved_at.slice(0, 10)}{item.source.truncated ? " · Source shortened" : ""}</p>{item.date_context && <p className="field-help evidence-date-context">{item.date_context.message}</p>}<blockquote>{item.text}</blockquote>{item.source.url && <a className="text-link" href={item.source.url} target="_blank" rel="noreferrer">Open original source <ExternalLink size={14} /></a>}{item.relation && <p className="model-relation">{relationLabels[item.relation]} · experimental English model</p>}<label htmlFor={`${id}-finding-${index}`}>Your assessment of this passage</label><select id={`${id}-finding-${index}`} value={item.finding} onChange={event => update(item.citationId, { finding: event.target.value as Finding })}><option value="unreviewed">Not reviewed</option><option value="supports">Supports the selected claim</option><option value="contradicts">Contradicts the selected claim</option><option value="insufficient">Insufficient or unrelated</option></select><label htmlFor={`${id}-note-${index}`}>Your reasoning and context</label><textarea id={`${id}-note-${index}`} maxLength={1000} value={item.note} onChange={event => update(item.citationId, { note: event.target.value })} placeholder="Explain your assessment, including date and context…" /><p className="print-only">Passage annotation: {item.finding}. {item.note || "No additional reader reasoning recorded."}</p></article>)}</div></>}
    <p className="section-description">This notebook lasts for this page session. Export it before leaving. Changing the selected claim clears its citations and assessments.</p>
  </section>;
}
