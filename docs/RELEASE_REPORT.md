# Verity 2.0 release record

## Baseline audit

The starting revision was `24110fc395de5581ac52eaa0a0a8130451349d5f`. Existing Next.js/FastAPI article and URL analysis, TF-IDF Logistic Regression/SVM, browser OCR/transcription, explanations, history and exports were preserved. Original `models/classifier.json` and `models/metrics.json` remain unchanged. The original API suite had 16 tests. See [baseline audit](BASELINE_AUDIT.md) for architecture and limitations.

## Implemented and verified

- Full-article candidate claims with original character offsets and transparent heuristic reasons.
- Actual source retrieval, verbatim evidence passages, timestamps, publisher/date metadata, citations, reader-authored findings and conflicts. Google Fact Check and GDELT use explicit unavailable states. Optional browser MiniLM ranking and DeBERTa NLI suggestions remain distinct from factual verification.
- Image OCR regions, reviewed text, optional CLIP description comparison, embedded C2PA inspection and manifest export. Signer trust is not established by this inspection.
- Video speech timestamps, bounded representative keyframes, frame OCR, seeking, reviewed text and exported media traces. Browser workers run asynchronously with cancellation, timeouts and one expensive job at a time.
- Typed v2 text/image/video/URL reports; transparent modality coverage and reader attribution; no arbitrary combined truth score. Short and unsupported-language text abstains. Hindi extraction is experimental.
- Reproducible robustness evaluation, data auditing, sampled semantic grouping, external-corpus evaluation pipeline, real local transformer pilots and an explicit model registry. No challenger was promoted.
- Responsive investigation/report interfaces, JSON downloads, optional history and browser print-to-PDF. Raw original uploads remain in the browser session.

## Actual model results and data

The original 10,000 rows contain 9,964 usable records after 36 duplicate removals; the CSVs cover historical 2016–2017 news and lack authenticated publisher IDs. The preserved headline-group split is 5,977 train / 1,994 calibration / 1,993 test. Original LR accuracy is 0.9904666 (macro F1 0.9904639); SVM accuracy is 0.9989965 (macro F1 0.9989962).

Separate chronological retraining uses 5,962 / 1,987 / 2,014 records: LR accuracy 0.9945382 and macro F1 0.9904579; SVM accuracy 0.9980139 and macro F1 0.9965262. Stratified headline-group retraining uses 5,978 / 1,993 / 1,993. A semantic diagnostic uses only a declared 500-record sample; it does not establish whole-corpus semantic deduplication. Reports include hashes, class counts, confusion matrices, per-class metrics, AUC, calibration, bootstrap/Wilson intervals and declared stress tests.

The following are executed one-epoch, frozen-encoder head-training CPU pilots: 64 train / 32 calibration / 32 test, 96-token truncation. They use identical partitions, with separately trained same-partition classical baselines. They are too small for model promotion. The original production model's larger test set is not a matched comparison.

| Pilot | Accuracy | Macro F1 | Warm single-request p95 |
|---|---:|---:|---:|
| distilbert-base-uncased | 0.96875 | 0.96872 | 30.51 ms |
| roberta-base | 1.00000 | 1.00000 | 86.54 ms |
| deberta-v3-base | 1.00000 | 1.00000 | 135.03 ms |

Latency includes tokenization and excludes download/cold start. Complete measured metrics, revisions, hashes, calibration, artifact sizes and limitations are in `reports/transformer-*.json`, `models/robustness.json` and `models/registry.json`. Tiny error-free test results do not establish general accuracy. All promotion decisions remain false.

## Validation record

- `.venv/bin/python -m pytest tests -q`: **39 passed**. One upstream Starlette TestClient deprecation warning remains.
- `npm run build`, `npm run typecheck`, `git diff --check`: **passed**.
- `npm run test:e2e -- --workers=1`: **10 passed, 12 skipped** in the deterministic desktop/mobile suite; opt-in integrations are skipped without flags.
- `RESEARCH_INTEGRATION=1 MEDIA_INTEGRATION=1 npm run test:e2e -- --workers=1`: real downloaded model integrations. All 11 mobile-emulation checks passed sequentially; desktop OCR/video, evidence/NLI, CLIP, signed/unsigned C2PA and Hindi extraction checks also passed during implementation. These establish specific execution examples, not population accuracy.
- Browser launches inside the filesystem sandbox failed before page execution; reruns require the normal Chromium operating-system permissions. An earlier concurrent real-model run was interrupted and was superseded by sequential checks; it is not counted as a pass.
- Docker Compose configuration validated. Container image builds/runs were **not verified**, because the installed Docker daemon is stopped and its socket is absent.
- Final publication and production smoke-check outcomes accompany the release handoff; build success alone is not claimed as live verification.

## Security changes

Preserved DNS-pinned public-URL fetching and SSRF/private-address protections. Added bounded source concurrency, request/body limits, per-process request throttling, typed media metadata constraints, original-file signature and decoder checks, frame/duration bounds, no-store/nosniff headers and request IDs. Request logs exclude article text, keys and source URLs. Credentials, datasets, model caches and local checkpoints are ignored and excluded from deployment. Recognition/visual media remain client-local; only reviewed text and bounded metadata reach the API. Provider links and optional model downloads are disclosed.

## Deployment

Use the existing [GitHub repository](https://github.com/Priti02707/Fake-News-Detection) and [production alias](https://verity-news-sable.vercel.app), project `priti-09/verity-news`. Install runtime/dev dependencies, start FastAPI and Next.js, then run the checks above. Deploy with `npx vercel --prod --scope priti-09`; verify `/api/health`, `/api/v2/capabilities`, `/api/v2/models/metrics` and real browser workflows. See [deployment instructions](DEPLOYMENT.md). Local PyTorch dependencies and checkpoints are intentionally excluded from the lightweight Vercel function.

## Incomplete work and remaining limits

Full transformer fine-tuning and independent-source model selection are configured but not executed as a validated benchmark; local pilots do not justify replacing production. Publisher-disjoint evaluation needs authenticated publisher metadata. No licensed independent corpus was acquired, so the external evaluator has schema/synthetic-test validation and no claimed external accuracy. Trained Hindi veracity, validated deepfake detection, image authenticity classification and automated evidence-grounded factual verdicts remain unvalidated and are not simulated. Evidence defaults to insufficient unless a reader supplies explicitly attributed findings. C2PA absence does not imply falsity, and CLIP/NLI similarity does not establish truth.

Google published fact-check search needs the owner's server-side API key (not configured). GDELT can rate-limit; manual source review works independently. No durable server media-job queue, shared database/vector service or GPU deployment was provisioned: the implemented bounded browser pipeline fits the current deployment. Source checks are not independent-source ground truth. Device memory, downloads, third-party outages, OCR/transcription errors and historical dataset bias remain practical limits. The API's rate guard is process-local, not a distributed quota service.

## Exact changed files

- `.dockerignore`
- `.env.example`
- `.github/workflows/checks.yml`
- `.gitignore`
- `.vercelignore`
- `Dockerfile.api`
- `Dockerfile.web`
- `MODEL_CARD.md`
- `README.md`
- `UPGRADE_REPORT.md`
- `app/analysis-summary.tsx`
- `app/content-credentials.tsx`
- `app/evidence.worker.ts`
- `app/file-format.ts`
- `app/globals.css`
- `app/image-context.tsx`
- `app/image-context.worker.ts`
- `app/investigation.tsx`
- `app/media-findings.tsx`
- `app/media-input.tsx`
- `app/media-types.ts`
- `app/media.worker.ts`
- `app/page.tsx`
- `app/robustness.tsx`
- `app/video-frames.ts`
- `app/worker-budget.ts`
- `backend/challenger.py`
- `backend/evidence_providers.py`
- `backend/extraction.py`
- `backend/fusion.py`
- `backend/investigation.py`
- `backend/language.py`
- `backend/main.py`
- `backend/registry.py`
- `backend/schemas.py`
- `backend/security.py`
- `backend/v2.py`
- `compose.yaml`
- `configs/transformer-benchmark.json`
- `configs/transformer-pilots.json`
- `configs/transformer-smoke.json`
- `docs/ARCHITECTURE.md`
- `docs/BASELINE_AUDIT.md`
- `docs/CHANGELOG_IMPLEMENTATION.md`
- `docs/DATASETS.md`
- `docs/DEPLOYMENT.md`
- `docs/EVALUATION.md`
- `docs/MODELS.md`
- `docs/MULTIMODAL_PIPELINES.md`
- `docs/RELEASE_REPORT.md`
- `docs/SECURITY.md`
- `models/browser-models.json`
- `models/registry.json`
- `models/robustness.json`
- `next.config.ts`
- `package-lock.json`
- `package.json`
- `reports/dataset-audit.json`
- `reports/semantic-holdout.json`
- `reports/transformer-deberta-v3-base-unavailable.json`
- `reports/transformer-deberta-v3-base.json`
- `reports/transformer-distilbert-base-uncased.json`
- `reports/transformer-roberta-base.json`
- `requirements-dev.txt`
- `requirements-ml.txt`
- `requirements.txt`
- `scripts/audit_data.py`
- `scripts/benchmark_transformers.py`
- `scripts/build_registry.py`
- `scripts/data_pipeline.py`
- `scripts/evaluate.py`
- `scripts/evaluate_external.py`
- `scripts/pin_browser_models.py`
- `tests/browser/investigation.spec.ts`
- `tests/browser/media.spec.ts`
- `tests/test_investigation.py`
- `tests/test_v2.py`
- `vercel.json`
