import type { Analysis, Saved } from "./news-types.ts";
import type { SourceVerification } from "./assessment";

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === "string");
const probability = (value: unknown) => value === null || typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
const webURL = (value: unknown) => {
  if (typeof value !== "string") return false;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
};

function modelResult(value: unknown): value is Analysis {
  return record(value) && ["fake", "real", "uncertain"].includes(String(value.verdict)) && typeof value.model === "string" && typeof value.model_name === "string" && probability(value.confidence) && probability(value.real_probability) && typeof value.word_count === "number" && typeof value.elapsed_ms === "number" && strings(value.reasons) && Array.isArray(value.claims) && value.claims.every(item => record(item) && typeof item.text === "string") && Array.isArray(value.explanations) && value.explanations.every(item => record(item) && typeof item.term === "string" && typeof item.weight === "number" && ["fake", "real"].includes(String(item.direction)));
}

const score = (value: unknown) => value === null || typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
const credibility = (value: unknown) => record(value) && typeof value.status === "string" && score(value.score) && typeof value.rationale === "string" && (value.policy_url === undefined || webURL(value.policy_url));

function sourceReview(value: unknown): value is SourceVerification {
  if (!record(value) || !["review_required", "unavailable", "no_matches", "assessed"].includes(String(value.status)) || !["SUPPORTED", "REFUTED", "MIXED", "INSUFFICIENT_EVIDENCE"].includes(String(value.assessment)) || typeof value.claim !== "string" || typeof value.checked_at !== "string" || typeof value.explanation !== "string" || typeof value.reader_notes !== "string" || !strings(value.warnings) || !Array.isArray(value.evidence)) return false;
  if (value.claims !== undefined && (!Array.isArray(value.claims) || value.claims.length > 3 || !value.claims.every(item => record(item) && typeof item.claim === "string" && ["SUPPORTED", "REFUTED", "MIXED", "INSUFFICIENT_EVIDENCE"].includes(String(item.assessment)) && typeof item.explanation === "string" && typeof item.assessor_status === "string" && Array.isArray(item.citations) && item.citations.every(citation => record(citation) && typeof citation.quote === "string" && typeof citation.passage_id === "string" && ["supports", "refutes"].includes(String(citation.stance)) && webURL(citation.source_url) && (citation.publisher === undefined || citation.publisher === null || typeof citation.publisher === "string"))))) return false;
  if (value.scores !== undefined && (!record(value.scores) || !score(value.scores.evidence_relevance) || !score(value.scores.evidence_coverage) || typeof value.scores.assessed_claims !== "number" || typeof value.scores.scope !== "string" || !credibility(value.scores.source_credibility))) return false;
  if (value.original_source !== undefined && value.original_source !== null && (!record(value.original_source) || typeof value.original_source.status !== "string" || !credibility(value.original_source.credibility) || value.original_source.final_url !== undefined && value.original_source.final_url !== null && !webURL(value.original_source.final_url))) return false;
  for (const key of ["news", "fact_checks"]) {
    const group = value[key];
    if (!record(group) || typeof group.message !== "string" || !Array.isArray(group.results) || group.search_url !== undefined && !webURL(group.search_url)) return false;
    if (!group.results.every(item => record(item) && webURL(item.url) && typeof item.title === "string" && typeof item.publisher === "string" && (item.rating === undefined || typeof item.rating === "string") && (item.date === undefined || typeof item.date === "string"))) return false;
  }
  return value.evidence.every(item => record(item) && record(item.source) && typeof item.source.title === "string" && typeof item.source.publisher === "string" && (item.source.url === null || webURL(item.source.url)) && typeof item.retrieved_at === "string" && (item.date_context === undefined || record(item.date_context) && typeof item.date_context.message === "string") && Array.isArray(item.passages) && item.passages.every(passage => record(passage) && typeof passage.id === "string" && typeof passage.text === "string" && typeof passage.start === "number" && typeof passage.end === "number"));
}

export function readSavedAssessments(value: unknown): Saved[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!record(item) || typeof item.id !== "string" || typeof item.text !== "string" || item.text.length > 20000 || typeof item.date !== "string" || !Number.isFinite(Date.parse(item.date))) return [];
    const result = modelResult(item.result) ? item.result : null;
    const verification = sourceReview(item.verification) ? item.verification : null;
    if (!result && !verification) return [];
    const review = ["none", "needs_review", "supports", "contradicts"].includes(String(item.review)) ? item.review : "none";
    const options = record(item.options) && ["detect", "verify", "detect_verify"].includes(String(item.options.mode)) && ["claim", "sourceUrl", "sourceText", "notes", "language"].every(key => typeof (item.options as Record<string, unknown>)[key] === "string") ? item.options : undefined;
    const report = record(item.report) && record(item.report.content_classification) && record(item.report.claim_verification) && typeof item.report.claim_verification.explanation === "string" && typeof item.report.claim_verification.assessment === "string" && record(item.report.modalities) && Object.values(item.report.modalities).every(value => typeof value === "string") && strings(item.report.conflicting_signals) && strings(item.report.uncertainty) && typeof item.report.observations_origin === "string" && (!item.report.media_classification || record(item.report.media_classification) && typeof item.report.media_classification.explanation === "string") ? item.report : null;
    const mediaTrace = record(item.mediaTrace) && ["image", "video", "audio"].includes(String(item.mediaTrace.kind)) && typeof item.mediaTrace.filename === "string" && typeof item.mediaTrace.original_text === "string" && Array.isArray(item.mediaTrace.segments) && item.mediaTrace.segments.every(segment => record(segment) && typeof segment.text === "string") && (item.mediaTrace.frames === undefined || Array.isArray(item.mediaTrace.frames) && item.mediaTrace.frames.every(frame => record(frame) && typeof frame.id === "string" && typeof frame.text === "string" && typeof frame.timestamp === "number")) ? item.mediaTrace : null;
    const source = record(item.source) && webURL(item.source.url) && typeof item.source.title === "string" && typeof item.source.publisher === "string" ? item.source : null;
    return [{ id: item.id, text: item.text, date: item.date, result, verification, review, options, report, mediaTrace, source } as Saved];
  }).slice(0, 30);
}
