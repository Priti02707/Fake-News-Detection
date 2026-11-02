"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Globe2, LoaderCircle, Search } from "lucide-react";

type Lead = { url: string; title: string; publisher: string; claim?: string; rating?: string; date?: string; indexed_at?: string; country?: string; language?: string };
type SearchResults = { status: "matches" | "no_matches" | "unavailable"; message: string; results: Lead[]; search_url?: string };
type Report = { query: string; checked_at: string; note: string; news: SearchResults; fact_checks: SearchResults };

const languages = { all: "All languages", en: "English", hi: "Hindi", es: "Spanish", fr: "French", pt: "Portuguese", de: "German", ar: "Arabic", bn: "Bengali", zh: "Chinese", ja: "Japanese", ru: "Russian", uk: "Ukrainian", id: "Indonesian", tr: "Turkish" };
const countries = { all: "Worldwide", india: "India", unitedstates: "United States", unitedkingdom: "United Kingdom", brazil: "Brazil", france: "France", germany: "Germany", nigeria: "Nigeria", southafrica: "South Africa", australia: "Australia", canada: "Canada", japan: "Japan" };

export default function WorldNews({ onInvestigate }: { onInvestigate: (claim: string, sources: Lead[]) => void }) {
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("all");
  const [country, setCountry] = useState("all");
  const [timespan, setTimespan] = useState("1month");
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  function reset() {
    request.current?.abort(); setBusy(false); setReport(null); setError("");
  }
  async function search() {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setReport(null); setError("");
    const timeout = setTimeout(() => controller.abort("timeout"), 20000);
    try {
      const response = await fetch("/api/world-news", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: query.trim(), language, country, timespan }) });
      if (!response.ok) throw new Error(response.status === 429 ? "Too many searches. Please try again in a minute." : "World news search could not complete. Please try again.");
      const result = await response.json() as Report;
      if (!controller.signal.aborted) setReport(result);
    } catch (error) {
      if (!controller.signal.aborted) setError((error as Error).message);
      else if (controller.signal.reason === "timeout") setError("World news search timed out. Please try again.");
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) setBusy(false);
    }
  }

  return <section className="subpage world-news">
    <div className="eyebrow">INTERNATIONAL COVERAGE · PUBLISHED FACT-CHECKS</div>
    <h1>World news,<br /><em>with context.</em></h1>
    <p className="page-intro">Investigate a news claim from anywhere in the world. Find related reporting and published fact-checks, then compare the claim, location and dates before drawing a conclusion.</p>
    <form className="card notebook-claim-editor" onSubmit={event => { event.preventDefault(); void search(); }}>
      <label htmlFor="world-query">World news claim or keywords</label>
      <textarea id="world-query" required minLength={8} maxLength={300} value={query} onChange={event => { reset(); setQuery(event.target.value); }} placeholder="Enter a specific claim, event or headline, including a place and date…" />
      <div className="world-filters">
        <div><label htmlFor="world-language">Source language</label><select id="world-language" value={language} onChange={event => { reset(); setLanguage(event.target.value); }}>{Object.entries(languages).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div><label htmlFor="world-country">News publisher country</label><select id="world-country" value={country} onChange={event => { reset(); setCountry(event.target.value); }}>{Object.entries(countries).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div><label htmlFor="world-timespan">News coverage window</label><select id="world-timespan" value={timespan} onChange={event => { reset(); setTimespan(event.target.value); }}><option value="1d">Past 24 hours</option><option value="7d">Past week</option><option value="1month">Past month</option><option value="3months">Past 3 months</option></select></div>
      </div>
      <p className="field-help">Search sends your query to GDELT and, when configured, Google Fact Check. Country filters describe the publisher’s location, which may differ from the event location. Country and date filters apply only to news. All languages removes the language filter; it does not translate your query. Try English keywords for wider news discovery.</p>
      <button className="primary-button" disabled={busy || query.trim().length < 8}>{busy ? <LoaderCircle size={17} className="spin" /> : <Globe2 size={17} />}Check world news</button>
      {busy && <button type="button" className="text-link" onClick={reset}>Cancel search</button>}
      {busy && <p role="status" className="field-help">Searching international news and published reviews…</p>}
      {error && <p role="alert" className="error-message">{error}</p>}
    </form>
    {report && <div aria-live="polite">
      <p className="world-summary">Review needed · Checked {new Date(report.checked_at).toLocaleString()}. A matching report or an empty search does not establish whether this claim is true or false.</p>
      <div className="world-results">{([{ key: "fact_checks", title: "Published fact-checks" }, { key: "news", title: "International news coverage" }] as const).map(({ key, title }) => {
        const group = report[key];
        return <section className="card world-result-group" key={key} aria-label={title}>
          <div className="card-header"><div><Search size={18} /><h2>{title}</h2></div></div>
          <p className="field-help">{group.status === "unavailable" ? "Provider unavailable. " : group.status === "no_matches" ? "No matches. " : ""}{group.message}</p>
          {group.search_url && <a className="text-link" href={group.search_url} target="_blank" rel="noreferrer">Search Fact Check Explorer manually <ExternalLink size={14} /></a>}
          {group.results.map((item, index) => <article className="coverage-result" key={`${item.url}-${index}`}>
            <a className="text-link" href={item.url} target="_blank" rel="noreferrer">{item.title} <ExternalLink size={14} /></a>
            <p className="field-help">{item.publisher}{item.country ? ` · ${item.country}` : ""}{item.language ? ` · ${item.language}` : ""} · {key === "fact_checks" ? `Published: ${item.date?.slice(0, 10) || "Unknown"}` : `Indexed: ${item.indexed_at || "Unknown"}`}</p>
            {item.claim && <p dir="auto">{item.claim}</p>}
            {item.rating && <p className="publisher-rating">Publisher’s rating: {item.rating}</p>}
            <button className="secondary-button" onClick={() => onInvestigate(report.query, [item])}>Review this source</button>
          </article>)}
        </section>;
      })}</div>
      <p className="field-help">{report.note} The article classifier remains evaluated on English text only.</p>
    </div>}
  </section>;
}
