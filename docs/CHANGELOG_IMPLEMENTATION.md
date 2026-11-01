# Implementation record

Baseline and file-by-file plan: [BASELINE_AUDIT.md](BASELINE_AUDIT.md). Baseline commit: `24110fc395de5581ac52eaa0a0a8130451349d5f`.

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
