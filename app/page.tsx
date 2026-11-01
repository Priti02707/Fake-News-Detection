"use client";

import { useEffect, useRef, useState } from "react";
import MediaInput from "./media-input";
import Investigation from "./investigation";
import Robustness from "./robustness";
import AnalysisSummary from "./analysis-summary";
import type { StructuredReport } from "./analysis-summary";
import MediaFindings from "./media-findings";
import type { MediaTrace, MediaPreviewFiles } from "./media-types";
import { ArrowDown, ArrowRight, ArrowUpRight, BarChart3, BookOpen, Check, ChevronRight, CircleHelp, Clock3, Download, ExternalLink, FileText, Globe2, History, ImagePlus, Info, Layers3, Link2, LoaderCircle, Menu, ScanLine, Search, ShieldCheck, Sparkles, Trash2, Video, X } from "lucide-react";

type View = "investigate" | "analyze" | "evaluation" | "history" | "about";
type Explanation = { term: string; weight: number; direction: "fake" | "real" };
type Analysis = { verdict: "fake" | "real" | "uncertain"; model: string; model_name: string; confidence: number | null; real_probability: number | null; explanations: Explanation[]; reasons: string[]; word_count: number; elapsed_ms: number; claims: { text: string; status: string; start?: number; end?: number; reasons?: string[] }[]; note: string };
type Saved = { id: string; date: string; text: string; result: Analysis; mediaTrace?: MediaTrace | null; report?: StructuredReport | null };
type Evidence = { status: string; message: string; search_url: string; results: { claim: string; publisher: string; title: string; url: string; rating: string; date: string }[] };
type Metrics = { dataset: string; input_rows: number; usable_rows: number; removed_rows: number; splits: { train: number; calibration: number; test: number }; protocol: string; limits: string[]; models: { id: string; name: string; accuracy: number; macro_f1: number; brier_score: number; errors: number; confusion_matrix: number[][]; scoring_ms_per_article: number; coverage: number; selective_accuracy: number }[] };
const storageKey = "verity.history.v1";
const sample = "The city council announced a new public transport proposal on Tuesday. Under the draft plan, two additional bus routes would connect residential neighborhoods with the central railway station. Officials said the proposal would be open for public comment for 30 days before a final vote. The transport department has not yet published the complete budget. Residents can submit feedback through the council website or attend a public meeting next month. The timeline and funding remain subject to approval.";

async function api<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(`/api/${path}`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof data?.detail === "string" ? data.detail : response.status === 422 ? "Please check your input and try again." : "We couldn’t complete the request. Please try again.");
  if (!data) throw new Error("The service returned an unexpected response. Please try again.");
  return data;
}

function Mark({ small = false }: { small?: boolean }) {
  return <span className={`brand-mark ${small ? "small" : ""}`} aria-hidden="true"><svg viewBox="0 0 40 40"><path d="m8 16 12 15L33 9M9 8l11 15" /></svg></span>;
}
function Highlighted({ text, terms }: { text: string; terms: Explanation[] }) {
  const selected = terms.filter(item => !item.term.includes(" "));
  const lookup = new Map(selected.map(item => [item.term, item.direction]));
  return <>{text.split(/(\b\w+\b)/g).map((part, i) => lookup.has(part.toLowerCase()) ? <mark key={i} className={`highlight-${lookup.get(part.toLowerCase())}`}>{part}</mark> : part)}</>;
}
function download(data: object, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
}

export default function Home() {
  const [view, setView] = useState<View>("analyze");
  const [mobile, setMobile] = useState(false);
  const [mode, setMode] = useState<"text" | "url" | "image" | "video">("text");
  const [text, setText] = useState("");
  const [mediaFiles, setMediaFiles] = useState<MediaPreviewFiles | null>(null);
  const [mediaTrace, setMediaTrace] = useState<MediaTrace | null>(null);
  const [evidenceLanguage, setEvidenceLanguage] = useState<"en" | "hi">("en");
  const [url, setUrl] = useState("");
  const [source, setSource] = useState<{ title: string; publisher: string; url: string; truncated: boolean } | null>(null);
  const [model, setModel] = useState("logistic");
  const [busy, setBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<Analysis | null>(null);
  const [structuredReport, setStructuredReport] = useState<StructuredReport | null>(null);
  const [analyzedText, setAnalyzedText] = useState("");
  const [history, setHistory] = useState<Saved[]>([]);
  const [saveHistory, setSaveHistory] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [metricsError, setMetricsError] = useState("");
  const [query, setQuery] = useState("");
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
      if (Array.isArray(stored)) setHistory(stored.filter(item => typeof item?.id === "string" && typeof item?.text === "string" && typeof item?.date === "string" && ["real", "fake", "uncertain"].includes(item?.result?.verdict) && Array.isArray(item?.result?.explanations) && Array.isArray(item?.result?.claims) && Array.isArray(item?.result?.reasons)).slice(0, 30));
    } catch { /* History is optional; a blocked browser store does not block analysis. */ }
  }, []);
  useEffect(() => {
    if (view === "evaluation" && !metrics) {
      setMetricsError("");
      api<Metrics>("metrics").then(setMetrics).catch(error => setMetricsError(error.message));
    }
  }, [view, metrics]);

  function navigate(next: View) { setView(next); setMobile(false); setNotice(""); }
  function resetAnalysis(value: string) { setText(value); setResult(null); setEvidence(null); setError(""); setNotice(""); }
  async function extract() {
    setError(""); setExtracting(true); setSource(null);
    try {
      const article = await api<{ title: string; publisher: string; url: string; text: string; truncated: boolean }>("extract", { url });
      resetAnalysis(`${article.title}\n\n${article.text}`.slice(0, 20000)); setSource(article); setMediaTrace(null); setMediaFiles(null); setMode("text");
      setNotice("Article extracted. Review the text below, then select Analyze article.");
    } catch (error) { setError((error as Error).message); }
    finally { setExtracting(false); }
  }
  async function analyze() {
    setError(""); setBusy(true); setResult(null); setEvidence(null); setSearchError("");
    try {
      const payload = await api<{ analysis: Analysis; report: StructuredReport }>(mediaTrace ? `v2/analyze/${mediaTrace.kind}` : "v2/analyze/text", { text, model, ...(mediaTrace ? { media: mediaTrace } : {}) });
      const response = payload.analysis; setStructuredReport(payload.report);
      setResult(response); setAnalyzedText(text); setQuery(response.claims[0]?.text || text.slice(0, 250));
      if (saveHistory) {
        const next = [{ id: crypto.randomUUID(), date: new Date().toISOString(), text, result: response, mediaTrace, report: payload.report }, ...history].slice(0, 30);
        try { localStorage.setItem(storageKey, JSON.stringify(next)); setHistory(next); }
        catch { setNotice("Analysis complete. Browser storage is unavailable or full, so this result was not saved."); }
      }
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  async function searchEvidence() {
    setSearching(true); setEvidence(null); setSearchError("");
    try { setEvidence(await api<Evidence>("fact-check", { query, language: evidenceLanguage })); }
    catch (error) { setSearchError((error as Error).message); }
    finally { setSearching(false); }
  }
  function clearHistory() {
    try { localStorage.removeItem(storageKey); setHistory([]); setNotice("Saved analyses cleared from this browser."); }
    catch { setNotice("Your browser did not allow us to clear storage. Use your browser’s site-data settings."); }
  }
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const label = result?.verdict === "real" ? "Real-like writing pattern" : result?.verdict === "fake" ? "Fake-like writing pattern" : "More context needed";
  const nav = [{ id: "analyze", icon: ScanLine, label: "Analyze news" }, { id: "investigate", icon: Search, label: "Investigate claims" }, { id: "evaluation", icon: BarChart3, label: "Model evaluation" }, { id: "history", icon: History, label: "Your history" }, { id: "about", icon: BookOpen, label: "How it works" }] as const;

  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <div className="mobile-bar"><a href="/" className="brand"><Mark small />verity<span className="brand-period">.</span></a><button className="icon-button" aria-label={mobile ? "Close navigation" : "Open navigation"} aria-expanded={mobile} onClick={() => setMobile(!mobile)}>{mobile ? <X /> : <Menu />}</button></div>
    <aside className={`sidebar ${mobile ? "open" : ""}`}>
      <a href="/" className="brand"><Mark />verity<span className="brand-period">.</span></a>
      <div className="sidebar-caption">A LITTLE CLARITY GOES A LONG WAY.</div>
      <div className="nav-label">WORKSPACE</div>
      <nav aria-label="Main navigation">{nav.map(item => <button key={item.id} className={`nav-item ${view === item.id ? "active" : ""}`} onClick={() => navigate(item.id)}><item.icon size={19} />{item.label}{view === item.id && <span className="nav-dot" />}</button>)}</nav>
      <div className="sidebar-note"><div className="tiny-orbit"><Globe2 size={23} /></div><h3>Pause. Explore. Understand.</h3><p>A thoughtful second look at the stories you read.</p><button onClick={() => navigate("about")}>Meet your news companion <ArrowUpRight size={15} /></button></div>
      <div className="sidebar-bottom"><div className="avatar">P</div><div><strong>A project by Priti</strong><span>Built with curiosity & care</span></div><a href="https://github.com/Priti02707/Fake-News-Detection" target="_blank" rel="noreferrer" aria-label="View Priti’s GitHub project"><ArrowUpRight size={17} /></a></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div><span className="breadcrumb">Workspace</span><ChevronRight size={14} /><span>{nav.find(item => item.id === view)?.label}</span></div><span className="research-badge"><span />EXPLAINABLE ML · ENGLISH</span></header>
      <main id="main" tabIndex={-1}>
        {notice && <div className="notice" role="status"><Info size={17} />{notice}<button className="icon-button" aria-label="Dismiss notice" onClick={() => setNotice("")}><X size={16} /></button></div>}
        {view === "analyze" && <>
          <section className="hero">
            <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line" /> LESS NOISE. MORE PERSPECTIVE.</div><h1>Read beyond<br />the <em>headline.</em><span className="hero-star">✳</span></h1><p>Get a clearer picture of what you’re reading.<br className="desktop-break" /> Explore the patterns, understand the prediction,<br className="desktop-break" /> and follow the evidence.</p><div className="hero-tags"><span><Check size={14} /> Explainable predictions</span><span><Check size={14} /> Transparent uncertainty</span></div></div>
            <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="art-spark">✳</div><div className="article-illustration"><div className="paper-top"><span>THE DAILY PERSPECTIVE</span><span>01</span></div><div className="paper-headline">There’s more<br />to every story.</div><div className="paper-lines"><i /><i /><i /></div><div className="paper-highlight" /><div className="paper-columns"><div /><div /><div /></div><div className="paper-footer">LOOK CLOSER. THINK CLEARER.</div></div><div className="art-label"><ShieldCheck size={17} /><span>A second look matters.</span></div><div className="art-check"><Check size={32} strokeWidth={1.5} /></div></div>
          </section>
          <section className="workspace-grid" aria-label="News analysis workspace">
            <div className="analysis-card card"><div className="card-header"><div><span className="step-number">01</span><h2>Let’s take a closer look</h2></div><span className="small-muted">Your reading, with context.</span></div>
              <div className="input-tabs" role="tablist" aria-label="Input type"><button role="tab" aria-selected={mode === "text"} className={mode === "text" ? "selected" : ""} onClick={() => setMode("text")}><FileText size={16} />Paste text</button><button role="tab" aria-selected={mode === "url"} className={mode === "url" ? "selected" : ""} onClick={() => setMode("url")}><Link2 size={16} />Article URL</button><button role="tab" aria-selected={mode === "image"} className={mode === "image" ? "selected" : ""} onClick={() => setMode("image")}><ImagePlus size={16} />Image</button><button role="tab" aria-selected={mode === "video"} className={mode === "video" ? "selected" : ""} onClick={() => setMode("video")}><Video size={16} />Video</button></div>
              {mode === "image" || mode === "video" ? <MediaInput key={mode} kind={mode} onReviewed={(reviewed, filename, trace, files) => { setMediaFiles(files); setMediaTrace(trace); setEvidenceLanguage(trace.language); resetAnalysis(reviewed); setSource(null); setMode("text"); setNotice(`Reviewed text from ${filename} is ready. Check the article editor, then select Analyze article. The assessment covers these words only.`); setTimeout(() => document.getElementById("article-text")?.focus(), 0); }} /> : mode === "url" ? <form onSubmit={event => { event.preventDefault(); void extract(); }} className="url-form"><label htmlFor="article-url">Article URL</label><div className="url-row"><input id="article-url" type="url" placeholder="https://publisher.com/article" required maxLength={2048} value={url} onChange={e => setUrl(e.target.value)} /><button className="primary-button" disabled={extracting}>{extracting ? <LoaderCircle className="spin" size={17} /> : <ArrowDown size={17} />}Extract</button></div><p className="field-help">We’ll extract the article for you to review before analysis. Some publishers block automated reading.</p></form> : <>
                {source && <div className="source-preview"><Globe2 size={16} /><div><strong>{source.title}</strong><span>{source.publisher}{source.truncated ? " · Long article shortened for analysis" : " · Review extracted text below"}</span></div><button className="icon-button" aria-label="Remove article source" onClick={() => setSource(null)}><X size={15} /></button></div>}
                <label htmlFor="article-text" className="sr-only">News article text</label><textarea id="article-text" value={text} maxLength={20000} onChange={event => { resetAnalysis(event.target.value); setSource(null); }} placeholder={"Paste a news article or a claim you’d like to explore…\n\nA full article gives the model more context than a headline alone."} />
                <div className="editor-meta"><span>{words.toLocaleString()} words <span className="meta-dot">·</span> {text.length.toLocaleString()} / 20,000 characters</span><button onClick={() => { resetAnalysis(sample); setSource(null); setMediaTrace(null); setMediaFiles(null); setNotice("Illustrative example loaded. This is invented practice text, not a verified news report."); }}>Try an example <ArrowUpRight size={13} /></button></div>
                <div className="input-controls"><div className="model-control"><label htmlFor="model">ANALYSIS MODEL</label><select id="model" value={model} onChange={event => { setModel(event.target.value); setResult(null); }}><option value="logistic">Logistic Regression</option><option value="svm">Calibrated Linear SVM</option></select></div><button className="primary-button analyze-button" onClick={() => void analyze()} disabled={busy || text.trim().length < 10}>{busy ? <><LoaderCircle size={17} className="spin" />Analyzing…</> : <>Analyze article <ArrowRight size={17} /></>}</button></div>
                <label className="history-opt"><input type="checkbox" checked={saveHistory} onChange={e => setSaveHistory(e.target.checked)} />Save this analysis in this browser</label>
              </>}
              {error && <p className="error-message" role="alert"><Info size={17} />{error}</p>}
              <div className="privacy-note"><ShieldCheck size={14} />Analysis runs on the server. History stays in your browser when enabled.</div>
            </div>
            <aside className="context-column"><div className="context-card"><div className="context-icon"><Layers3 size={20} /></div><h3>Clarity, one layer at a time.</h3><div className="process-step"><span>1</span><div><strong>Explore the patterns</strong><p>Compare the article with patterns learned from labeled news.</p></div></div><div className="process-step"><span>2</span><div><strong>Understand the why</strong><p>See the words that influenced the model’s prediction.</p></div></div><div className="process-step"><span>3</span><div><strong>Follow the evidence</strong><p>Search published fact-checks and read the original sources.</p></div></div></div><div className="gentle-note"><CircleHelp size={19} /><p><strong>A prediction is a starting point.</strong> Writing patterns alone cannot establish whether a story is true.</p></div></aside>
          </section>
          {result && <div ref={resultsRef} className="results-section" tabIndex={-1}>
            <div className="section-heading"><div><div className="eyebrow">YOUR ARTICLE, UNPACKED</div><h2>A little more perspective.</h2></div><button className="secondary-button" onClick={() => download({ created_at: new Date().toISOString(), text: analyzedText, source, analysis: result, fact_checks: evidence, media_trace: mediaTrace, report: structuredReport }, "verity-analysis.json")}><Download size={16} />Download report</button><button className="secondary-button" onClick={() => window.print()}>Print / save PDF</button></div>
            <div className={`result-card card result-${result.verdict}`}><div className="result-symbol">{result.verdict === "uncertain" ? <CircleHelp size={30} /> : <ScanLine size={30} />}</div><div className="result-main"><div className="eyebrow">MODEL ASSESSMENT</div><h3>{label}</h3><p>{result.verdict === "uncertain" ? "The model cannot offer a confident classification for this text." : `This article resembles ${result.verdict}-labeled examples in the training data.`}</p><span className="result-model">{result.model_name} · {result.word_count} words · {result.elapsed_ms.toFixed(1)} ms server inference</span></div><div className="confidence"><strong>{result.confidence === null ? "—" : `${(result.confidence * 100).toFixed(1)}%`}</strong><span>calibrated model score</span><small>Not a probability of truth</small></div></div>
            {result.reasons.length > 0 && <div className="uncertainty-details"><Info size={18} /><div><strong>Why we’re being cautious</strong><ul>{result.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></div></div>}
            {structuredReport && <AnalysisSummary report={structuredReport} />}
            {mediaTrace && <MediaFindings trace={mediaTrace} files={mediaFiles} />}
            <div className="explanation-grid"><section className="card explanation-card"><div className="card-header"><h3>What influenced this prediction?</h3><Sparkles size={18} /></div><p className="section-description">Words and phrases that moved the classifier’s score. These explain its behavior; they are not factual evidence.</p><div className="legend"><span><i className="green-dot" />Toward real-labeled</span><span><i className="coral-dot" />Toward fake-labeled</span></div><div className="word-contributions">{result.explanations.length ? result.explanations.slice(0, 8).map(term => <div className="contribution-row" key={term.term}><span>{term.term}</span><div className="contribution-track"><div className={term.direction} style={{ width: `${Math.max(3, Math.abs(term.weight) / Math.max(...result.explanations.map(item => Math.abs(item.weight)), .001) * 100)}%` }} /></div><span>{term.weight > 0 ? "+" : ""}{term.weight.toFixed(3)}</span></div>) : <p className="muted">No meaningful word explanations are available for this input.</p>}</div></section><section className="card explanation-card"><div className="card-header"><h3>Your text, highlighted</h3><FileText size={18} /></div><p className="section-description">Top individual words are highlighted in context. Phrase contributions appear in the chart.</p><div className="highlighted-text"><Highlighted text={analyzedText} terms={result.explanations} /></div></section></div>
            <div className="investigate-callout"><div><strong>Investigate the claims, with sources.</strong><p>Build a cited evidence notebook and record your own assessment.</p></div><button className="primary-button" onClick={() => navigate("investigate")}>Open evidence notebook <ArrowRight size={16} /></button></div><section className="card evidence-card"><div className="card-header"><div><span className="step-number">02</span><h2>Follow the evidence</h2></div><Search size={19} /></div><p className="section-description">Choose a sentence to investigate or edit your search. These are candidate sentences extracted from your text; none has been automatically verified.</p><div className="claim-list">{result.claims.map((claim, index) => <button key={index} className={query === claim.text ? "claim active-claim" : "claim"} onClick={() => { setQuery(claim.text); setEvidence(null); }}><span>0{index + 1}</span><span>{claim.text}</span><small>UNVERIFIED</small></button>)}</div><form onSubmit={event => { event.preventDefault(); void searchEvidence(); }}><label htmlFor="fact-query">Search published fact-checks</label><div className="evidence-search"><input id="fact-query" minLength={8} maxLength={300} required value={query} onChange={event => { setQuery(event.target.value); setEvidence(null); }} /><button className="primary-button" disabled={searching}>{searching ? <LoaderCircle className="spin" size={17} /> : <Search size={17} />}Search</button></div><p className="field-help">This search sends your query to Google Fact Check when configured.</p></form>{searchError && <p role="alert" className="error-message">{searchError}</p>}{evidence && <div aria-live="polite" className="evidence-results"><p className="evidence-message"><Info size={16} />{evidence.message}</p>{evidence.results.map((item, index) => <a className="evidence-item" href={item.url} key={`${item.url}-${index}`} target="_blank" rel="noreferrer"><div><span className="eyebrow">{item.publisher} {item.date && `· ${item.date.slice(0, 10)}`}</span><h3>{item.title}</h3><p>{item.claim}</p><span className="publisher-rating">Publisher’s rating: {item.rating}</span></div><ExternalLink size={18} /></a>)}<a className="text-link" href={evidence.search_url} target="_blank" rel="noreferrer">Open Google Fact Check Explorer <ArrowUpRight size={15} /></a></div>}</section>
          </div>}
          <div className="bottom-strip"><span><Globe2 size={16} />Made for thoughtful readers.</span><span>English articles <i /> Two interpretable models <i /> Open source</span></div>
        </>}
        {view === "evaluation" && <section className="subpage"><div className="eyebrow">MEASURED, NOT ASSUMED</div><h1>The model,<br /><em>under the lens.</em></h1><p className="page-intro">Real measurements from a held-out set of your project’s original articles. An honest picture of what works—and what still needs testing.</p>{metricsError ? <div className="card empty-state"><Info /><h3>Evaluation could not be loaded</h3><p>{metricsError}</p><button className="secondary-button" onClick={() => { setMetricsError(""); api<Metrics>("metrics").then(setMetrics).catch(e => setMetricsError(e.message)); }}>Try again</button></div> : !metrics ? <div role="status" className="loading-state"><LoaderCircle className="spin" />Loading evaluation…</div> : <>
          <div className="metric-cards">{[{ value: metrics.usable_rows.toLocaleString(), label: "usable articles" }, { value: metrics.splits.train.toLocaleString(), label: "training articles" }, { value: metrics.splits.calibration.toLocaleString(), label: "calibration articles" }, { value: metrics.splits.test.toLocaleString(), label: "held-out test articles" }].map(item => <div className="card metric-card" key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>)}</div>
          <div className="card evaluation-table"><h2>Two models. One evaluation protocol.</h2><div className="table-scroll"><table><thead><tr><th>Model</th><th>Accuracy</th><th>Macro F1</th><th>Brier score ↓</th><th>Errors</th><th>Score time*</th></tr></thead><tbody>{metrics.models.map(item => <tr key={item.id}><td><strong>{item.name}</strong><small>Validation-calibrated</small></td><td>{(item.accuracy * 100).toFixed(2)}%</td><td>{item.macro_f1.toFixed(4)}</td><td>{item.brier_score.toFixed(4)}</td><td>{item.errors}</td><td>{item.scoring_ms_per_article.toFixed(4)} ms</td></tr>)}</tbody></table></div><p className="field-help">*Per-article sparse scoring and calibration in a batch. Excludes text processing, cold starts, and network latency. Brier score measures probability error; lower is better.</p></div>
          <div className="explanation-grid">{metrics.models.map(item => <div className="card confusion-card" key={item.id}><h3>{item.name}</h3><p className="section-description">Confusion matrix · rows: actual, columns: predicted</p><div className="confusion-matrix"><span /><span>Fake</span><span>Real</span><span>Fake</span><strong>{item.confusion_matrix[0][0]}</strong><strong className="mistake">{item.confusion_matrix[0][1]}</strong><span>Real</span><strong className="mistake">{item.confusion_matrix[1][0]}</strong><strong>{item.confusion_matrix[1][1]}</strong></div><p className="field-help">{(item.coverage * 100).toFixed(1)}% of test articles meet the model-score threshold of 80%. Website checks for short text, vocabulary overlap, and model disagreement can reduce coverage further.</p></div>)}</div>
          <div className="card protocol-card"><h2>How these numbers were measured</h2><p>{metrics.protocol}</p><p>{metrics.input_rows.toLocaleString()} input rows → {metrics.usable_rows.toLocaleString()} usable articles. Removed {metrics.removed_rows} empty, conflicting, or duplicate rows.</p><h3>Where the evidence stops</h3><ul>{metrics.limits.map(limit => <li key={limit}>{limit}</li>)}</ul><button className="secondary-button" onClick={() => download(metrics, "verity-evaluation.json")}><Download size={16} />Download evaluation</button></div>
        </>}</section>}
        {view === "evaluation" && <Robustness />}
        {view === "history" && <section className="subpage"><div className="eyebrow">YOUR READING JOURNEY</div><h1>A second look,<br /><em>saved for later.</em></h1><p className="page-intro">Analyses you chose to save on this browser. No account required. Clearing browser data removes them.</p><div className="history-heading"><span>{history.length} saved {history.length === 1 ? "analysis" : "analyses"}</span>{history.length > 0 && <button className="secondary-button" onClick={clearHistory}><Trash2 size={16} />Clear history</button>}</div>{history.length ? <div className="history-list">{history.map(item => <div className="card history-item" key={item.id}><div className={`history-symbol ${item.result.verdict}`}><FileText size={21} /></div><button className="history-open" onClick={() => { setText(item.text); setAnalyzedText(item.text); setMediaTrace(item.mediaTrace || null); setMediaFiles(null); setStructuredReport(item.report || null); setResult(item.result); setSource(null); setEvidence(null); setQuery(item.result.claims[0]?.text || item.text.slice(0, 250)); navigate("analyze"); setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100); }}><strong>{item.text.slice(0, 110)}{item.text.length > 110 ? "…" : ""}</strong><span><Clock3 size={13} />{new Date(item.date).toLocaleString()} · {item.result.verdict === "uncertain" ? "Uncertain" : `${item.result.verdict}-like pattern`}</span></button><button className="icon-button" aria-label="Download saved analysis" onClick={() => download(item, "verity-saved-analysis.json")}><Download size={18} /></button></div>)}</div> : <div className="card empty-state"><History size={34} /><h3>A fresh perspective starts here.</h3><p>Enable “Save this analysis” when exploring an article.<br />Your saved results will appear here.</p><button className="primary-button" onClick={() => navigate("analyze")}>Explore an article <ArrowRight size={16} /></button></div>}</section>}
        {view === "about" && <section className="subpage about-page"><div className="eyebrow">CURIOSITY, WITH CONTEXT</div><h1>Understand more.<br /><em>Assume less.</em></h1><p className="page-intro">Verity is an explainable machine learning project by Priti. It helps you explore how a classifier reads news and find published fact-checks to investigate further.</p><div className="about-grid">{[{ icon: Layers3, title: "Patterns from your project data", text: "Two linear classifiers learn TF-IDF word and phrase patterns from the original project’s English article samples. A separate validation set calibrates their scores." }, { icon: Sparkles, title: "Explanations you can inspect", text: "Each highlighted word contributes to a linear decision score. Positive and negative contributions show how the model reached a classification. They do not establish factual truth." }, { icon: CircleHelp, title: "Room for uncertainty", text: "The app returns Uncertain for low scores, short inputs, unfamiliar vocabulary, unsupported scripts, or disagreement between models. English-script text is not a guarantee of supported language." }, { icon: Search, title: "Evidence beyond the model", text: "Search uses Google Fact Check to find existing reviews when an API key is configured. Results preserve each publisher’s wording and rating. A related result does not automatically verify your article." }].map(item => <article className="card about-card" key={item.title}><item.icon size={25} /><h3>{item.title}</h3><p>{item.text}</p></article>)}</div><div className="card protocol-card"><h2>A transparent first release</h2><p>Available: English text analysis, public article extraction, image text extraction, video speech transcription, explanations, evaluation, optional browser history, JSON reports, and configurable published fact-check search. Image and video extraction run on your device; review the words before analysis. These features do not detect manipulated images or deepfake videos.</p><p>Available now: a citation notebook, verbatim passage retrieval, optional English semantic ranking and textual-entailment assistance, media location traces, C2PA inspection, and experimental Hindi extraction. Future research: independently evaluated Hindi classifiers, image-context models, and deepfake detection. Extracted sentences currently remain unverified.</p><h3>Your text and privacy</h3><p>Images and videos stay in your browser during extraction. Recognition downloads use third-party model hosts, which may receive standard connection metadata. Reviewed text is sent to our server when you select Analyze article. The application does not save article bodies to a database. Optional history is kept in this browser, limited to 30 entries. Fact-check searches send your chosen query to Google when configured. Hosting providers may retain standard request metadata.</p><a className="text-link" target="_blank" rel="noreferrer" href="https://github.com/Priti02707/Fake-News-Detection">Explore the source on GitHub <ArrowUpRight size={16} /></a></div></section>}
        {view === "investigate" && <section className="subpage investigation-intro"><div className="eyebrow">CLAIMS, CONTEXT, CITATIONS</div><h1>Follow the<br /><em>evidence.</em></h1><p className="page-intro">Choose one factual claim. Gather source passages, compare the wording, and record your reasoning. Reader assessments and experimental model suggestions are kept separate.</p><div className="card notebook-claim-editor"><label htmlFor="investigation-claim">Claim to investigate</label><textarea id="investigation-claim" maxLength={300} value={query} onChange={event => { setQuery(event.target.value); setEvidence(null); }} placeholder="Enter one specific factual statement, including its date and context…" /><label htmlFor="evidence-language">Published fact-check search language</label><select id="evidence-language" value={evidenceLanguage} onChange={event => { setEvidenceLanguage(event.target.value as "en" | "hi"); setEvidence(null); }}><option value="en">English</option><option value="hi">Hindi</option></select><button className="primary-button" disabled={searching || query.trim().length < 8} onClick={() => void searchEvidence()}>{searching ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />}Find published fact-checks</button>{searchError && <p role="alert">{searchError}</p>}{evidence && <div className="notebook-search-results" role="status"><p>{evidence.message}</p>{evidence.results.map((item, index) => <a className="evidence-item" href={item.url} key={`${item.url}-${index}`} target="_blank" rel="noreferrer"><div><strong>{item.title}</strong><p>{item.publisher} · {item.rating} · {item.date.slice(0, 10)}</p><p>{item.claim}</p></div><ExternalLink size={16} /></a>)}<a className="text-link" href={evidence.search_url} target="_blank" rel="noreferrer">Search manually in Fact Check Explorer <ExternalLink size={14} /></a></div>}</div></section>}
        <div hidden={view !== "investigate"}><Investigation active={view === "investigate"} claim={query} sources={evidence?.results || []} /></div>
      </main>
      <footer><span>verity<span className="brand-period">.</span> <span className="footer-divider">/</span> A clearer view of the news.</span><span>Made by Priti <span className="footer-dot">✳</span> Keep asking questions.</span></footer>
    </div>
  </div>;
}
