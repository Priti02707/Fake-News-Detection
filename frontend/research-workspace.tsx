"use client";

import { ArrowDown, ArrowUpRight, Download, FileText, ImagePlus, LoaderCircle, Save, ScanLine, ShieldCheck, Trash2, Video } from "lucide-react";
import type { Analysis, ReaderReview, Saved } from "./news-types";
import { reviewLabels } from "./news-types";
import type { SourceVerification } from "./assessment";

export function AssessmentPreview({ analysis, verification, busy, error, onDetails, onChoose }: { analysis: Analysis | null; verification: SourceVerification | null; busy: boolean; error: string; onDetails: () => void; onChoose: (kind: "text" | "image" | "video") => void }) {
  return <section className="card assessment-overview" aria-label="News assessment">
    <div className="card-header"><div><span className="step-number">02</span><h2>News assessment</h2></div><span className="assessment-status">{busy ? "PROCESSING" : analysis || verification ? "REPORT READY" : error ? "NEEDS ATTENTION" : "AWAITING INPUT"}</span></div>
    {busy ? <div className="assessment-waiting" role="status"><LoaderCircle className="spin" size={38} /><h3>Taking a closer look…</h3><p>Running the selected assessment. Source searches may take a few seconds.</p></div> : !analysis && !verification ? <div className="assessment-waiting">
      <div className="assessment-orbit" aria-hidden="true"><span><ScanLine size={30} /></span></div>
      <p className="eyebrow">CLARITY STARTS WITH CONTEXT</p><h3>Every claim deserves<br />a closer look.</h3>
      <p>{error ? "Check the input message and try again." : "Enter a specific news claim or article."}<br />See model scores, source evidence and clear limitations.</p>
      <div className="empty-input-shortcuts"><button onClick={() => onChoose("text")}><FileText size={14} />Text</button><button onClick={() => onChoose("image")}><ImagePlus size={14} />Image</button><button onClick={() => onChoose("video")}><Video size={14} />Video</button></div>
    </div> : <div className="assessment-preview-body" aria-live="polite">
      {analysis && <><span className="eyebrow">{analysis.model_name} · WRITING PATTERNS</span><h3>{analysis.verdict === "uncertain" ? "The model needs more context" : analysis.verdict === "fake" ? "Fake-like writing pattern" : "Real-like writing pattern"}</h3><div className="assessment-model-score"><strong>{analysis.confidence === null ? "—" : `${(analysis.confidence * 100).toFixed(1)}%`}</strong><span>Calibrated model score<br />Not a probability of truth</span></div>{analysis.reasons.slice(0, 2).map(reason => <p className="field-help" key={reason}>{reason}</p>)}</>}
      <div className="assessment-factual-status"><ShieldCheck size={20} /><div><strong>{verification ? "Source review: insufficient evidence" : "Sources have not been checked"}</strong><p>{verification ? verification.status === "unavailable" ? "Live verification is unavailable. The model result remains separate." : `${verification.evidence.reduce((total, item) => total + item.passages.length, 0)} exact passages · ${verification.fact_checks.results.length} related published reviews. Review context and dates.` : "Choose detection + source verification to gather evidence alongside the model."}</p></div></div>
      <button className="secondary-button" onClick={onDetails}>View full report <ArrowDown size={16} /></button>
    </div>}
  </section>;
}

export function SavedAssessments({ items, review, onReview, canSave, onSave, onRestore, onDelete, onClear, onDownload }: { items: Saved[]; review: ReaderReview; onReview: (review: ReaderReview) => void; canSave: boolean; onSave: () => void; onRestore: (item: Saved) => void; onDelete: (id: string) => void; onClear: () => void; onDownload: (item: Saved) => void }) {
  return <section className="card saved-assessments" aria-label="Saved assessments">
    <div className="card-header"><h2>Saved assessments</h2><button className="text-link" disabled={!items.length} onClick={onClear}>Clear all</button></div>
    <div className="saved-assessments-body"><p className="field-help">Save up to 30 reports with their original text, assessment mode, notes and source details in this browser. Raw media files are not saved.</p>
      <label htmlFor="reader-review">Your review (not a verified label)</label><select id="reader-review" value={review} onChange={event => onReview(event.target.value as ReaderReview)}>{Object.entries(reviewLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select>
      <button className="secondary-button" disabled={!canSave} onClick={onSave}><Save size={15} />Save current report</button>
      {items.length ? <div className="saved-assessment-list">{items.map(item => <article key={item.id}><button className="saved-assessment-open" onClick={() => onRestore(item)}><strong>{item.text.slice(0, 95)}{item.text.length > 95 ? "…" : ""}</strong><span>{new Date(item.date).toLocaleDateString()} · {item.result ? item.result.verdict === "uncertain" ? "Uncertain model result" : `${item.result.verdict}-like writing pattern` : "Source verification"}</span><small>{reviewLabels[item.review || "none"]}</small></button><div><button className="icon-button" aria-label="Download saved report" onClick={() => onDownload(item)}><Download size={15} /></button><button className="icon-button" aria-label="Delete saved report" onClick={() => onDelete(item.id)}><Trash2 size={15} /></button></div></article>)}</div> : <p className="saved-empty">No saved assessments yet.</p>}
      <p className="field-help saved-history-link">Reviews are your annotations, not verified truth labels.</p>
    </div>
  </section>;
}
