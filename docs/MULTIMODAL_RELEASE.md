# Connected multimodal verification release

Date: 2026-11-01. Starting feature revision: `53a3e92`; production baseline: `0bc7a38`. This release builds on the existing interface, browser workers, extraction security and research API. The owner explicitly authorized GitHub publication and production deployment for these three features.

## Implemented behavior

- Image–news mismatch review retains the caption and alternative description, model/revision and relative CLIP scores. Explicit review rules flag a stronger alternative without declaring the claim false. A selected caption launches bounded evidence gathering; optional models remain cancellable.
- Video investigation timelines sort timestamped speech and frame OCR, expose unavailable text, preserve original locations, seek playback, flag nearby wording/topic differences for inspection, and export timeline JSON. Full-clip temporal sampling replaces an early-frame cap that could omit later content. English lexical review flags are not an evaluated contradiction detector.
- Explainable evidence verification connects selected media observations to one GDELT search and at most two unique public-source retrievals. Citations retain exact quotes, publisher, date, retrieval timestamp and source links. Optional Google reviews and browser NLI remain distinct from reader findings. Provider failures, empty results, mixed reader annotations and unavailable visual analysis remain explicit. Contextual JSON and browser print-to-PDF retain media origins and uncertainty.
- Images are decoded and dimension-checked before optional visual comparison. Multiple notebook/frame instances use unique accessible IDs. Changes to the selected claim/file cancel retrieval and clear prior findings. Raw files remain local. No paid API or deepfake detector was introduced.

## Validation

- `.venv/bin/python -m pytest tests -q`: **63 passed, 1 skipped** (opt-in saved research checkpoint test); existing Starlette deprecation warning remains.
- `npm run test:unit`: **10 passed**, exercising review-rule and sampling boundaries. Node emits a module-type inference warning; it does not affect test execution.
- `npm run build` and `npm run typecheck`: passed. Browser checks use a separate production build with `API_ORIGIN=http://127.0.0.1:8011` and isolated local web/API servers.
- Deterministic desktop/mobile workflow checks: **18 passed, 14 skipped**. Synthetic worker/source fixtures explicitly validate integration and failure behavior, not AI accuracy. Network-heavy optional cases are skipped in the default suite.
- Actual browser image OCR: passed on desktop and mobile.
- Actual browser VP8/WebM decode, frame sampling/OCR, playback seeking, timeline export and media-context investigation: passed on desktop and mobile using an original locally generated four-second silent video. The fixture has a declared affirmative budget caption in the first half and negative caption in the second; it is not a real news claim.
- Opt-in real NLI/CLIP/Whisper run: **1 passed (OCR), 3 failed/unavailable**. CLIP image and Whisper audio fixture requests failed with Hugging Face DNS resolution errors; NLI model comparison displayed its unavailable/manual-review state. These failures are not counted as model passes or benchmark results. No external provider/model availability guarantee is claimed.
- Production classifier weights, original metrics and registry match the production baseline byte-for-byte. No training, factual-verification calibration or model promotion was performed. Independent-domain mismatch, temporal contradiction, OCR/ASR and deepfake accuracy remain unmeasured.

## Release boundaries

The 0.2 relative visual margin, two-second speech/frame alignment, 0.6/0.15 lexical overlap thresholds and scene-change rule are declared review heuristics. Reader-provided alternative descriptions affect CLIP ranking. Similarity cannot establish event identity, date, location, provenance or truth. Automatic source leads may be unrelated, syndicated or outdated. Source independence and relevance require inspection. Speech/OCR can be inaccurate and unsampled scenes can be missed. English comparison is experimental; trained Hindi veracity and deepfake detection remain research work. Google Fact Check needs the owner's server-side API key.

Deployment status will be recorded after actual Vercel publication and production checks.

## Changed files in this increment

- `.github/workflows/checks.yml`
- `MODEL_CARD.md`
- `README.md`
- `app/globals.css`
- `app/image-context.tsx`
- `app/investigation.tsx`
- `app/layout.tsx`
- `app/media-findings.tsx`
- `app/media-input.tsx`
- `app/media-types.ts`
- `app/multimodal.ts`
- `app/page.tsx`
- `app/video-frames.ts`
- `app/video-timeline.tsx`
- `backend/schemas.py`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG_IMPLEMENTATION.md`
- `docs/EVALUATION.md`
- `docs/MULTIMODAL_PIPELINES.md`
- `docs/MULTIMODAL_RELEASE.md`
- `docs/SECURITY.md`
- `package.json`
- `tests/browser/investigation.spec.ts`
- `tests/browser/media.spec.ts`
- `tests/browser/multimodal.spec.ts`
- `tests/browser/video-fixture.ts`
- `tests/test_v2.py`
- `tests/unit/multimodal.test.mjs`
