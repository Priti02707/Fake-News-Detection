export type VisualComparison = { model: string; revision: string; matches: { label: string; score: number }[]; scope: string };
export type ProvenanceObservation = { status: "found" | "not_found" | "unavailable"; validation_state?: string; signer_trust: "not_checked" };
export type MediaPreviewFiles = { source: File; frames: { id: string; file: File }[] };
export type MediaSegment = { text: string; start?: number; end?: number | null; confidence?: number; bbox?: { x0: number; y0: number; x1: number; y1: number } };
export type MediaTrace = { filename: string; kind: "image" | "video"; language: "en" | "hi"; original_text: string; segments: MediaSegment[]; width?: number; height?: number; frames?: FrameObservation[]; frame_sampling?: { interval: number; max_frames: number; method: string }; warnings?: string[]; visual_consistency?: VisualComparison; provenance?: ProvenanceObservation };
export type FrameObservation = { id: string; timestamp: number; width: number; height: number; text: string; scene_change: number; ocr_status: "text_found" | "no_text" | "failed"; visual_consistency?: VisualComparison };
export type VideoTrace = MediaTrace & { frames?: FrameObservation[]; frame_sampling?: { interval: number; max_frames: number; method: string }; warnings?: string[] };
