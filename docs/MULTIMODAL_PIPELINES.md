# Multimodal execution and honest outputs

## Text and URLs

The browser submits article text or extracts a public HTML article using the existing pinned-connection SSRF defenses. Language identification and conservative abstention precede display of supported scores. Candidate statements are heuristically prioritized throughout the text, preserving offsets and selection reasons. No trained claim-spotting accuracy is claimed.

## Claims and evidence

Google Fact Check search is optional and credentialed. GDELT provides optional recent-news leads, not fact-check verdicts; outages/rate limits remain distinct from no matches. Source URLs/pasted text feed verbatim BM25 passage extraction. Optional local MiniLM ranking and English NLI compare wording, not source authenticity or factual truth. Reader assessments explicitly identify their author and can conflict. Citations, dates, retrieval timestamps and original excerpts are exported. API claim verification returns insufficient evidence unless a validated verification stage exists; missing search results never imply truth.

## Images

Supported image formats, size and dimension limits are validated before OCR. OCR uses browser decoding and returns original line rectangles with editable text. Optional CLIP compares two English descriptions using relative scores; it does not determine dates/locations or detect manipulation. Embedded C2PA inspection is separate, with remote manifests disabled and signer trust not established. No credentials does not mean fake. Visual tools are optional and their absence is explicitly recorded, rather than counting OCR as visual verification.

## Videos

Browser-supported MP4/WebM/MOV clips are bounded to 25 MB, 60 seconds and at most 4K frame dimensions. Web Audio decodes/resamples the track for Whisper; speech segments retain timestamps. A separate HTML video/canvas pipeline samples bounded keyframes, selects representative pixel scene changes, and runs Tesseract OCR on sampled frames. Sampling interval and maximum frame count are configurable. Users can seek to a frame, inspect its text, optionally compare frame descriptions with CLIP, and choose whether to add on-screen text to the review. Silent clips can use the visual track independently.

Media jobs execute asynchronously in browser workers with cancellation/timeouts. They do not block FastAPI with long-running decoding. Sampling can miss intervening scenes/subtitles, codec support varies, and OCR/ASR can be wrong. The browser's decoded orientation is used; exhaustive camera-orientation correctness across codecs is not established. Hindi extraction is experimental; the English classifier still abstains on unsupported language.

## Fusion and reports

`backend/fusion.py` lists modalities actually supplied/analyzed, client provenance, missing stages, classifier findings, insufficient factual evidence and conflicting signals. It never creates a weighted truth probability. Image/video v2 API routes accept reviewed extraction metadata; raw files are not uploaded or independently authenticated. JSON reports preserve source/segment/frame observations, while browser Print / save PDF prints the current investigative view. No deepfake or complete video-authenticity verdict is simulated.

## Connected evidence workflows

Image claims now retain the two input descriptions with CLIP model/revision and relative scores. A 0.2 margin in favor of the alternative triggers a **potential mismatch to investigate**. Scores favoring the caption only establish relative preference among those inputs. Absent/malformed/legacy comparisons remain inconclusive. The threshold is an unvalidated review heuristic, not factual accuracy, provenance or manipulation detection. Image decoding/dimension checks run before making the selected file available to visual analysis.

Video sampling chooses bounded temporal targets across the entire clip, preserving first/last targets and selecting scene changes between them. The previous early-frame cap could omit the latter part of long clips; full-clip target spacing fixes that coverage issue. Speech segments and frame OCR become a sorted timeline. English content-word overlap compares a frame with speech overlapping its timestamp within two seconds: high overlap (at least 0.6) plus different negation flags wording for review; very low overlap (under 0.15) flags potentially different topics. At least three content terms on each side are required. Narration, quotations, OCR errors and context can explain either signal. Untimed speech is not assigned a fabricated timestamp.

Selecting an image claim/frame/speech moment opens the citation notebook with media context. One source-discovery request gathers at most two unique URLs' passages through the existing public-source extraction controls. Failed/empty sources remain explicit; no source or verdict is invented. The user can switch between GDELT leads, optional Google published reviews, protected URL retrieval and pasted evidence. Sources are not automatically independent merely because their domains differ. Optional browser NLI remains a separate textual-relation suggestion.

The contextual investigation JSON includes citations, dates, selected filename/timestamp, original visual comparison, reader findings, and an explicit insufficient automated factual assessment. Timeline JSON retains all bounded timeline entries and limitations. Browser print-to-PDF retains nested citation notebook content. Deepfake detection remains unimplemented research requiring independent evaluation.

## Classification upgrade — 2026-11-02

Standalone audio accepts WAV/MP3/M4A/OGG/FLAC/WebM up to 20 MB and 60 seconds. MIME/signature checks precede real browser decoding; silent/unsupported clips fail explicitly. Audio is resampled to mono 16 kHz, transcribed by the existing bounded Whisper worker, and reviewed before classification. Playback timestamps, original transcript and reviewed words are retained separately. No acoustic or synthetic-speech model is deployed. Full-media results abstain independently of text predictions.
