import type { AssessmentOptions, SourceVerification } from "./assessment";
import type { StructuredReport } from "./analysis-summary";
import type { MediaTrace } from "./media-types";

export type Explanation = { term: string; weight: number; direction: "fake" | "real" };
export type Analysis = { verdict: "fake" | "real" | "uncertain"; model: string; model_name: string; confidence: number | null; real_probability: number | null; explanations: Explanation[]; reasons: string[]; word_count: number; elapsed_ms: number; claims: { text: string; status: string; start?: number; end?: number; reasons?: string[] }[]; note: string };
export type ReaderReview = "none" | "needs_review" | "supports" | "contradicts";
export type Saved = { id: string; date: string; text: string; result: Analysis | null; mediaTrace?: MediaTrace | null; report?: StructuredReport | null; verification?: SourceVerification | null; options?: AssessmentOptions; review?: ReaderReview; source?: { url: string; title: string; publisher: string; truncated: boolean } | null };

export const reviewLabels: Record<ReaderReview, string> = { none: "No review", needs_review: "Needs closer review", supports: "Reader notes supporting sources", contradicts: "Reader notes contradicting sources" };
