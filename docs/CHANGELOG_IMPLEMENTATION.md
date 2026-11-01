# Implementation record

Baseline and file-by-file plan: [BASELINE_AUDIT.md](BASELINE_AUDIT.md). Baseline commit: `24110fc395de5581ac52eaa0a0a8130451349d5f`.

## Follow-up correctness check — 2026-11-01

Starting revision: `697181f`, with a clean working tree. The existing Python baseline passed all 39 tests. Inspection found that `/api/v2/analyze/url` called legacy inference directly, bypassing the v2 short-input abstention policy. Also, the shared v2 guard counted whitespace-delimited punctuation as words.

- `backend/v2.py`: route extracted URL text through the shared v2 classifier guard; count word tokens using the same expression as legacy inference. Short inputs return uncertainty with no confidence or class probability. Full articles retain normal inference and extracted source metadata.
- `tests/test_v2.py`: add regression cases for short URL content, punctuation padding across URL/text inputs, and full-article URL/text prediction parity. URL retrieval is mocked; these tests make no external-source availability claim.
- Validation: `.venv/bin/python -m pytest tests -q` — **42 passed**; `npm run build`, `npm run typecheck`, and `git diff --check` — **passed**. The existing Starlette TestClient deprecation warning remains. Browser/model integration checks and deployment were not rerun for this backend correction. Production weights and recorded benchmark metrics were not changed.

## Implemented in this working release

- Preserved baseline weights, routes, training script, explanations, history, article/URL/OCR/ASR flows and existing Vercel project.
- Added claim prioritization, verbatim evidence retrieval, source dates, optional recent-news discovery, semantic ranking/NLI assistance, reader assessments, conflicts and citation exports.
- Added OCR regions, speech timestamps, bounded video keyframes/frame OCR, optional image-description comparison, experimental Hindi extraction and embedded Content Credentials inspection.
- Added typed versioned report APIs, transparent modality aggregation, stronger language handling, request IDs, bounded guards and body limits.
- Added reproducible robustness/data audits, optional transformer pipelines, checksummed registry/promotion criteria and pinned browser model revisions.
- Added investigative summaries, current-view print/save-PDF, research/deployment exclusions, Docker configuration and focused tests/documentation.

## Explicitly not promoted or claimed

No transformer challenger is automatically promoted. Small pilots do not establish generalization. A validated Hindi misinformation classifier, independently validated deepfake detector, complete scene authenticity verification, authenticated publisher holdout, and external-corpus accuracy remain separate research work. No paid service, database, GPU host or durable server-job system is silently provisioned. The browser executes current media jobs asynchronously.

## Validation record

Executed experiment artifacts are in `reports/`; baseline and robustness metrics are in `models/`. Final test counts, production checks and deployment result are recorded in the final release report. Interrupted or unavailable external checks are not counted as passes. See the remaining limitations and commands in the adjacent documentation.
