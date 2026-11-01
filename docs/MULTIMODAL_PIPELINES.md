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
