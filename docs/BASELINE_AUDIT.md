# Baseline audit and implementation plan

Baseline: commit `24110fc395de5581ac52eaa0a0a8130451349d5f`, a clean `main` synchronized with origin when the upgrade began. This record describes the inspected baseline, not features subsequently added in this working tree. It was written after the expanded master specification arrived; the baseline is preserved in Git and was not recreated.

## Working features preserved

| Files | Verified baseline behavior | Upgrade action |
|---|---|---|
| `app/page.tsx`, `app/globals.css` | Responsive article/URL editor, explanations, evidence search, history, evaluation, JSON exports | Preserve design and flows; add an evidence notebook and structured coverage summary |
| `backend/main.py` | Analyze, extract, fact-check, metrics, health routes; uncertainty rules; 100 KB POST limit | Keep legacy contracts; add versioned schemas, correlation IDs, bounded request guards |
| `backend/inference.py`, `models/classifier.json` | Portable TF-IDF, calibrated LR/SVM, signed feature contributions | Preserve production weights and explanations; record checksums |
| `scripts/train.py`, `models/metrics.json` | Seeded headline-group holdout and separate calibration | Preserve reproducibility; add independent experiments and challenger tooling |
| `backend/extraction.py` | Public-IP checks on all DNS answers/redirects, pinned connections, TLS verification, size/time limits | Reuse these controls for evidence sources; retain dates |
| `app/media-input.tsx`, `app/media.worker.ts` | Browser-local English OCR and short-video speech extraction, editable review, cancellation | Add regions, timestamps, keyframes/frame OCR, experimental context/provenance tools |
| `tests/`, `.github/workflows/checks.yml` | API/build/type/browser checks | Retain regression cases; extend contracts and real-model opt-in checks |
| `vercel.json`, `api/index.py` | Next.js plus lightweight FastAPI on the existing Vercel project | Preserve deployment; exclude research caches/checkpoints |

Baseline verification from the preceding completed work: 16 API cases passed, build and typecheck passed, desktop/mobile article and media flows passed, and three real-media checks passed on the production URL. These counts describe that baseline, not the final release checks.

## Baseline measured model results

9,964 usable examples from 10,000 recovered rows; 5,977 train / 1,994 calibration / 1,993 test. TF-IDF fits training only and sigmoid calibration fits validation only. Accuracy: LR 99.05%, SVM 99.90%; macro F1 0.9905 and 0.9990. These values come from `models/metrics.json`.

## Weaknesses and boundaries found in actual code

- Candidate extraction chose the first three sufficiently long sentences, rather than considering later claims.
- Published fact-check retrieval did not establish that a result addressed the same claim/date.
- Language handling was based on script ratio, which could miss non-English Latin-script text.
- There was no temporal/publisher holdout, semantic duplicate diagnostic, external-corpus result, model registry, or transformer benchmark pipeline.
- OCR and speech text were returned without visible regions/timestamps; video had no frame inspection.
- Image uploads did not analyze visual context or credentials.
- There was no validated factual-truth or deepfake detector. High article accuracy did not establish these capabilities.
- Google fact-check search required an owner-supplied key; credentials were not manufactured or exposed.
- Research artifacts and long-running inference must remain outside the lightweight Vercel runtime.

## Concrete file-by-file plan

1. `backend/schemas.py`, `security.py`, `language.py`, `v2.py`: typed compatible contracts, fallible language checks, bounded guards, versioned reports.
2. `backend/investigation.py`, `app/investigation.tsx`, `app/evidence.worker.ts`: verbatim retrieval, citations, source discovery, separate model/reader assessments.
3. `scripts/evaluate.py`, `data_pipeline.py`, `audit_data.py`, `benchmark_transformers.py`, `backend/challenger.py`: audited preprocessing, disjoint evaluation, optional research candidates without automatic promotion.
4. `backend/registry.py`, `models/registry.json`, `models/browser-models.json`: artifact metadata and pinned remote revisions.
5. `app/video-frames.ts`, existing media components: bounded asynchronous browser frame sampling/OCR and preserved speech timestamps.
6. `app/image-context*`, `content-credentials.tsx`: optional, explicitly limited visual-language and C2PA observations.
7. `backend/fusion.py`, `app/analysis-summary.tsx`: transparent modality coverage and uncertainty, without a combined truth score.
8. `tests/`, `reports/`, `docs/`, Docker files and deployment exclusions: regression/integration evidence, reproducibility, honest capability documentation.
