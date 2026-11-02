"use client";

import { Download, ExternalLink, Search, ShieldCheck } from "lucide-react";

export type AssessmentOptions = { mode: "detect" | "verify" | "detect_verify"; claim: string; sourceUrl: string; sourceText: string; notes: string; language: string };
type Lead = { url: string; title: string; publisher: string; rating?: string; claim?: string; date?: string };
type Discovery = { status: string; message: string; results: Lead[]; search_url?: string };
export type SourceVerification = {
  status: "review_required" | "unavailable" | "no_matches";
  assessment: "INSUFFICIENT_EVIDENCE"; confidence: null; claim: string; claim_selection: string; checked_at: string;
  news: Discovery; fact_checks: Discovery; warnings: string[]; reader_notes: string; explanation: string;
  evidence: { source: { title: string; publisher: string; url: string | null }; passages: { id: string; text: string; start: number; end: number }[]; date_context?: { message: string }; retrieved_at: string }[];
};

export const defaultAssessment: AssessmentOptions = { mode: "detect", claim: "", sourceUrl: "", sourceText: "", notes: "", language: "all" };

export function AssessmentControls({ value, onChange, busy }: { value: AssessmentOptions; onChange: (next: AssessmentOptions) => void; busy: boolean }) {
  function update(next: Partial<AssessmentOptions>) { onChange({ ...value, ...next }); }
  return <section className="assessment-controls" aria-label="Assessment options">
    <label htmlFor="assessment-mode">Assessment mode</label>
    <select id="assessment-mode" disabled={busy} value={value.mode} onChange={event => update({ mode: event.target.value as AssessmentOptions["mode"] })}>
      <option value="detect">Fake news detection</option>
      <option value="detect_verify">Fake news detection + source verification</option>
      <option value="verify">Source verification only</option>
    </select>
    <p className="field-help">{value.mode === "detect" ? "Trained English article model, explanations and uncertainty." : value.mode === "verify" ? "Find published reviews and exact source passages without running the article classifier." : "Run the trained model and gather current source evidence in one action."}</p>
    {value.mode !== "detect" && <>
      <details className="assessment-source-notes"><summary>Source &amp; verification notes (optional)</summary>
        <label htmlFor="assessment-claim">Specific claim to verify</label><input id="assessment-claim" disabled={busy} minLength={8} maxLength={300} value={value.claim} onChange={event => update({ claim: event.target.value })} placeholder="Leave empty to select one candidate statement from the news text" />
        <label htmlFor="assessment-source-url">Evidence source URL</label><input id="assessment-source-url" disabled={busy} type="url" maxLength={2048} value={value.sourceUrl} onChange={event => update({ sourceUrl: event.target.value })} placeholder="https://original-source.example/report" />
        <label htmlFor="assessment-source-text">Evidence text to review</label><textarea id="assessment-source-text" disabled={busy} maxLength={20000} value={value.sourceText} onChange={event => update({ sourceText: event.target.value })} placeholder="Optional source passage (at least 40 characters). Pasted evidence is not authenticated." />
        <label htmlFor="assessment-notes">Your context and verification notes</label><textarea id="assessment-notes" disabled={busy} maxLength={1000} value={value.notes} onChange={event => update({ notes: event.target.value })} placeholder="Event date, location, original source or details you want to check…" />
        <label htmlFor="assessment-language">Published review language</label><select id="assessment-language" disabled={busy} value={value.language} onChange={event => update({ language: event.target.value })}><option value="all">All languages</option><option value="en">English</option><option value="hi">Hindi</option></select>
      </details>
      <p className="field-help">Verification sends the selected claim to GDELT and, when configured, Google Fact Check. Without an explicit source, up to two news leads are read. Provider failures remain visible; a match is not a factual verdict. Media files stay in your browser.</p>
    </>}
  </section>;
}

export function VerificationAssessment({ data, onInvestigate }: { data: SourceVerification; onInvestigate: (claim: string, sources: Lead[]) => void }) {
  function exportReport() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ schema_version: 1, source_verification: data }, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "fake-news-detection-verification.json"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const linked = [...data.evidence.flatMap(item => item.source.url ? [{ url: item.source.url, title: item.source.title, publisher: item.source.publisher }] : []), ...data.fact_checks.results, ...data.news.results];
  const links = [...new Map(linked.map(item => [item.url, item])).values()];
  return <section className="card verification-assessment" aria-label="Source verification report">
    <div className="card-header"><div><ShieldCheck size={21} /><h2>Source verification</h2></div><span className="publisher-rating">{data.status === "review_required" ? "Evidence needs review" : data.status === "unavailable" ? "Verification unavailable" : "No relevant evidence found"}</span></div>
    <div className="verification-body">
      <h3>Factual assessment: Insufficient evidence</h3>
      <blockquote dir="auto">{data.claim}</blockquote>
      <p className="field-help">{data.claim_selection === "reader_selected" ? "Your selected claim" : "One candidate claim selected heuristically"} · Checked {new Date(data.checked_at).toLocaleString()}</p>
      <p>{data.explanation}</p>
      {data.reader_notes && <p><strong>Your notes (unverified context):</strong> {data.reader_notes}</p>}
      <div className="verification-providers">{([{ key: "fact_checks", title: "Published fact-checks" }, { key: "news", title: "News coverage" }] as const).map(({ key, title }) => <section key={key} aria-label={title}><h3>{title}</h3><p className="field-help">{data[key].message}</p>{data[key].search_url && <a className="text-link" href={data[key].search_url} target="_blank" rel="noreferrer">Search fact-checks manually <ExternalLink size={13} /></a>}{data[key].results.map((item, index) => <article className="coverage-result" key={`${item.url}-${index}`}><a className="text-link" href={item.url} target="_blank" rel="noreferrer">{item.title} <ExternalLink size={13} /></a><p className="field-help">{item.publisher}{item.date ? ` · ${item.date.slice(0, 10)}` : ""}</p>{item.rating && <p className="publisher-rating">Publisher’s rating: {item.rating}</p>}</article>)}</section>)}</div>
      {data.evidence.map((item, index) => <article className="verification-quotes" key={`${item.source.url}-${index}`}><h3>{item.source.title}</h3><p className="field-help">{item.source.publisher} · Retrieved {item.retrieved_at.slice(0, 10)}</p>{item.date_context && <p className="field-help">{item.date_context.message}</p>}{item.passages.length ? item.passages.map(passage => <blockquote dir="auto" key={passage.id}>{passage.text}</blockquote>) : <p>No passages matched this claim. This does not establish truth or falsehood.</p>}{item.source.url && <a className="text-link" href={item.source.url} target="_blank" rel="noreferrer">Read original source <ExternalLink size={13} /></a>}</article>)}
      {data.warnings.length > 0 && <ul>{data.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
      <div className="verification-actions"><button className="primary-button" onClick={() => onInvestigate(data.claim, links)}><Search size={16} />Review in evidence notebook</button><button className="secondary-button" onClick={exportReport}><Download size={16} />Download verification report</button></div>
    </div>
  </section>;
}
