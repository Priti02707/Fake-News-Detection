import type { MediaTrace, VisualComparison } from "./media-types";

export type VisualReview = { status: "potential_mismatch" | "no_relative_mismatch" | "inconclusive"; explanation: string };
export type TimelineEntry = { id: string; timestamp: number; end?: number | null; channel: "speech" | "frame"; text: string; reasons: string[]; frameId?: string };
export type MediaEvidenceContext = { filename: string; kind: "image" | "video"; channel: "caption" | "speech" | "frame"; timestamp?: number; visual_review?: VisualReview; visual_comparison?: VisualComparison; timeline_entry?: TimelineEntry };

// Declared review heuristics, never factual-verification thresholds.
export const VISUAL_REVIEW_MARGIN = .2;
const normalize = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");

export function reviewVisual(comparison?: VisualComparison | null): VisualReview {
  const claim = comparison?.matches.find(item => normalize(item.label) === normalize(comparison.claim || ""));
  const alternative = comparison?.matches.find(item => normalize(item.label) === normalize(comparison.alternative || ""));
  if (!claim || !alternative || normalize(claim.label) === normalize(alternative.label) || ![claim.score, alternative.score].every(score => Number.isFinite(score) && score >= 0 && score <= 1))
    return { status: "inconclusive", explanation: "No usable paired visual comparison is available. Investigate the claim with sources; event, date and location are unverified." };
  const margin = alternative.score - claim.score;
  if (margin + 1e-9 >= VISUAL_REVIEW_MARGIN) return { status: "potential_mismatch", explanation: "The alternative description matched the image more strongly than the supplied headline or caption. Investigate a possible mismatch with independent sources; this relative match does not establish that the caption is false." };
  if (margin - 1e-9 <= -VISUAL_REVIEW_MARGIN) return { status: "no_relative_mismatch", explanation: "The supplied headline or caption matched more strongly among these two descriptions. The image's event, date, location and the claim's truth remain unverified." };
  return { status: "inconclusive", explanation: "The two descriptions received similar relative matches. The comparison is inconclusive; inspect the image and gather evidence." };
}

const stop = new Set("a an the and or of to in on at for from with by is are was were be been has have had this that it not no never did does do".split(" "));
function terms(text: string) { return new Set((text.toLowerCase().match(/[a-z]+/g) || []).filter(word => word.length > 1 && !stop.has(word))); }
const negated = (text: string) => /\b(?:not|no|never|\w+n't)\b/i.test(text);
const timed = (value: number | undefined) => value !== undefined && Number.isFinite(value) && value >= 0 && value <= 60;

export function frameSampleTimes(duration: number, interval: number, maximum: number): number[] {
  if (!Number.isFinite(duration) || duration <= 0 || duration > 60 || !Number.isFinite(interval) || interval < 1 || !Number.isInteger(maximum) || maximum < 1 || maximum > 6) throw new Error("Invalid bounded frame sampling options.");
  const count = Math.min(maximum, Math.max(1, Math.ceil(duration / interval)));
  const padding = Math.min(.05, duration / 4);
  return Array.from({ length: count }, (_, index) => count === 1 ? duration / 2 : padding + index * (duration - 2 * padding) / (count - 1));
}

export function buildTimeline(trace: MediaTrace): TimelineEntry[] {
  if (trace.kind !== "video") return [];
  const entries: TimelineEntry[] = [];
  for (const [index, segment] of trace.segments.slice(0, 150).entries()) {
    if (!timed(segment.start) || !segment.text.trim()) continue;
    entries.push({ id: `speech-${index}`, timestamp: segment.start!, end: segment.end !== null && timed(segment.end) && segment.end! >= segment.start! ? segment.end : undefined, channel: "speech", text: segment.text.slice(0, 300), reasons: ["Speech recognition is unverified; check names, wording and factual claims against sources."] });
  }
  for (const frame of (trace.frames || []).slice(0, 6)) {
    if (!timed(frame.timestamp)) continue;
    const reasons: string[] = [];
    if (frame.ocr_status === "failed") reasons.push("On-screen text could not be read in this frame.");
    else if (!frame.text.trim()) reasons.push("No readable on-screen text was found in this sampled frame.");
    else reasons.push("On-screen text is an OCR observation; review it before investigating.");
    if (frame.visual_consistency) reasons.push(reviewVisual(frame.visual_consistency).explanation);
    const spoken = trace.segments.filter(segment => timed(segment.start) && segment.start! <= frame.timestamp + 2 && ((segment.end !== undefined && segment.end !== null && timed(segment.end)) ? segment.end : segment.start!) >= frame.timestamp - 2).map(segment => segment.text).join(" ");
    const screenTerms = terms(frame.text), speechTerms = terms(spoken);
    if (screenTerms.size >= 3 && speechTerms.size >= 3) {
      const overlap = [...screenTerms].filter(word => speechTerms.has(word)).length / Math.min(screenTerms.size, speechTerms.size);
      if (overlap >= .6 && negated(frame.text) !== negated(spoken)) reasons.push("Nearby speech and on-screen text differ in negation. Inspect the wording and context for a potential contradiction.");
      else if (overlap < .15) reasons.push("Nearby speech and on-screen text use different topics. This may be ordinary narration; inspect their context together.");
    }
    entries.push({ id: `visual-${frame.id}`, timestamp: frame.timestamp, channel: "frame", frameId: frame.id, text: frame.text.slice(0, 300), reasons });
  }
  return entries.sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
}
