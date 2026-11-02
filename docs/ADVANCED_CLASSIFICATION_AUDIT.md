# Classification-focused upgrade audit — 2026-11-02

Baseline revision: `a4623b3`, clean main. Baseline verification: 63 Python tests passed (one opt-in checkpoint case skipped), 10 Node logic tests passed. Existing UI/worker/model evaluation records remain in the adjacent release documents.

## Retain

Preserve evaluated English LR/SVM weights, calibrated scores, signed feature contributions, grouped/chronological evaluation, strict URL fetching, browser-local OCR/Whisper, CLIP comparison, frames/timestamps, optional source notebook, history and existing Vercel project/domains. Keep the separate local transformer research service and its artifact verification. Preserve API compatibility.

## Upgrade

1. Make fake-news classification the primary workspace and add dashboard/input navigation.
2. Add standalone audio upload, safe local decoding, Whisper review and explicit speech-text classification.
3. Allow reviewed media words to be classified in place, with a full-media Uncertain result rather than suggesting that transcript scoring classifies visual/acoustic content.
4. Add theme selection and drag-and-drop with validation, progress and cancellation.
5. Implement a real local early/late/attention fusion training/evaluation pipeline on declared paired embedding datasets, with modality masks, held-out calibration, provenance/checksums and no automatic production promotion.
6. Extend API/UI tests, documentation and deployment verification. Keep evidence investigation optional.

## Dataset/model boundaries

The original CSVs have unresolved provenance/licensing; they cannot justify newly licensed training claims. Existing transformer pilots are tiny execution checks, not independent-source validation. No paired image/video/audio misinformation training corpus, independently labeled Hindi/mixed-language test set, or validated forensic checkpoint exists in this checkout.

Dataset investigation: [Fakeddit](https://github.com/entitize/Fakeddit) provides Reddit-derived text/media and task-specific usage guidance; [NewsCLIPpings](https://github.com/g-luo/news_clippings) targets generated out-of-context pairs; [VERITE](https://github.com/stevejpapad/image-text-verification) is an image-text verification benchmark. Public availability or a repository code license alone does not establish redistribution/training rights for every linked media item. These task labels must not be blindly merged into article veracity labels. No new dataset is represented as acquired or validated by this upgrade.

Consequently new full-image, video-level, acoustic, multilingual and deepfake classifiers cannot honestly be marked evaluated or promoted. Their production responses remain unavailable/Uncertain with no invented scores. The fusion pipeline will accept operator-reviewed data and feature provenance; synthetic tests validate code only. Heavyweight training and long-video server jobs stay outside Vercel, which continues to host the lightweight application. Long inputs are explicitly bounded rather than routed to a pretend background queue.

## Acceptance and reporting

Classification must remain the main workflow; audio and existing media flows must actually decode/transcribe and send only reviewed words/metadata. Unsupported languages and full-media predictions must abstain honestly. The optional fusion pipeline must run actual optimization/calibration/evaluation and reject split leakage, invalid features and unreviewed licensing. All existing tests/builds, new tests and public production workflows must be checked before publication. Final results and outstanding research requirements will be appended after execution.

## Offline paired-feature dataset contract

Install `requirements-ml.txt` in a local research environment. The NPZ contains float feature matrices named `text`, `image`, `video`, and/or `audio` (at least two, N×D, D≤2048), integer `labels` (N,), and a binary `mask` (N, number of declared modalities). Mask columns follow the fixed order **text, image, video, audio**, omitting undeclared modalities. Missing values are represented by mask=0; all arrays must still be finite. Each row needs at least one observed modality and every declared modality must occur in training.

The JSON manifest declares `task: multimodal_news_classification`, a nonempty `source_url`, `license`, `license_reviewed: true`, `label_mapping: {"0":"fake","1":"real"}`, the NPZ's `features_sha256`, and `encoders` keyed by modality, each with `model` and `revision`. The aligned `examples` array contains unique `id`, nonempty `publisher` and `duplicate_group`, and `split` equal to `train`, `validation`, or `test`. Require at least 12 rows, at least four per split, and both labels in each partition. Use considerably larger independently reviewed data for meaningful research.

Publishers and duplicate groups must not cross splits. Observed encoder vectors are screened across splits using cosine ≥0.995 by default (`near_duplicate_cosine_threshold` can explicitly select [0.8,1]). This is conservative overlap screening, not complete semantic deduplication or authenticated provenance. Computation remains quadratic despite bounded intermediate matrices. Training-only per-modality normalization avoids calibration/test fitting leakage.

```sh
.venv/bin/python scripts/train_multimodal.py \
  --features data/multimodal/features.npz \
  --manifest data/multimodal/manifest.json \
  --output .artifacts/fusion-run-001 --epochs 10
.venv/bin/python scripts/predict_multimodal.py \
  --checkpoint .artifacts/fusion-run-001 \
  --sample data/multimodal/sample.json --mode attention
```

The sample JSON maps present modality names to embedding vectors from the same recorded encoders. Omit missing modalities. Training writes `early.safetensors`, `late.safetensors`, `attention.safetensors` and `evaluation.json` to a new directory; existing output directories are rejected. Reports retain data/manifest/checkpoint hashes, normalization, seed, dimensions, versions, training time, calibration and held-out metrics. Fusion-only latency excludes feature extraction. Optional `--tracking-uri` uses separately installed `requirements-tracking.txt`; tracking is off by default.

Inference validates checkpoint path and checksum, returns an explicitly labeled research prediction, and keeps production-facing verdict uncertain with null confidence. No raw-media encoder, external-corpus validation or automatic promotion is provided.

## Completed continuation and verification

Resumed the existing uncommitted upgrade without discarding files. Initial continuation checks: 69 Python tests passed, one skipped; 10 Node logic tests passed; type checking passed. Verification used fresh local API/web servers on ports 8100/3100 because the pre-existing servers were running older code. Those pre-existing processes were left untouched.

Implemented and checked: capability-driven dashboard and input selection, saved light/dark preference, audio upload/preview and shared speech decoding, in-place reviewed-word analysis, explicit full-media abstention, audio API contract and timestamps, downloadable report scope, and actual offline early/late/attention optimization/calibration/checkpoint reload. Browser silent-WAV decoding was real, without mocked decoding. The optional desktop Whisper check used the public-domain JFK speech WAV referenced by Transformers.js documentation and verified transcription, reviewed-word submission, audio findings and downloaded report metadata.

Commands and observed results:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run test:unit` | 11 passed |
| `.venv/bin/python -m pytest -q` | 71 passed, 1 skipped (opt-in saved transformer checkpoint) |
| `.venv/bin/python -m pytest tests/test_multimodal_training.py -q` after recording training configuration/versions | 6 passed, actual synthetic training/inference included |
| `API_ORIGIN=http://127.0.0.1:8100 npm run build` | Passed |
| `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npm run test:e2e` before adding the opt-in audio case | 22 passed, 14 opt-in skipped across desktop/mobile |
| `MEDIA_INTEGRATION=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npm run test:e2e -- --project=desktop tests/browser/classification.spec.ts -g 'actual audio'` | 1 passed; real speech/model download, no recognition mock |
| `git diff --check` | Passed |

Existing Node module-type and Starlette TestClient deprecation warnings remain nonfatal. Small final copy edits clarify that audio stays local and either classification button sends reviewed words; they do not alter processing.

## Measured models and remaining work

No new independent misinformation benchmark was run and no model was promoted. Recorded original LR/SVM accuracy remains 99.05% / 99.90%, macro-F1 0.9905 / 0.9990 and Brier 0.0062 / 0.0013, with 5,977 train / 1,994 calibration / 1,993 test articles from 9,964 usable rows. Those historical results have the source/leakage limitations described in the existing model card; they are not new external validation.

The fusion execution fixture contains 36 seeded synthetic rows: 12 train, 12 validation, 12 test, two labels per split, and disjoint declared publishers/groups. Its numeric metrics are deliberately not advertised as misinformation performance. No licensed paired corpus, independent multilingual benchmark, full-media classifier, validated synthetic-media detector, GPU service or durable media queue was acquired/provisioned. The code trains feature fusion, not raw-media encoders. Licensing, encoder revision and source metadata remain operator assertions. Attention is not a factual explanation; held-out calibration is not automatically valid on new domains.

The existing SSRF and request guards remain active. New audio checks cover MIME/container mismatch, file size, real silent decoding, duration/timestamp bounds and text-only prediction scope. Research checkpoints use safe tensors, hashes and contained paths; no Python pickle loading is introduced. Data and artifacts remain ignored/excluded from deployment.

Use the README's existing local/Vercel setup; heavy optional dependencies stay in the local research environment. At the earlier local checkpoint, publication had not been performed. The subsequent GitHub/Vercel release and production verification are recorded in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md#publication-record). Heavy OCR/CLIP/NLI/C2PA/Hindi integrations were not rerun; the actual audio check was desktop-only. External generalization and model promotion require reviewed data and separate evaluation.

## Exact working-tree file list

Includes the pre-existing unfinished upgrade plus this continuation's fixes/tests/docs:

- `.gitignore`
- `.vercelignore`
- `README.md`
- `backend/fusion.py`
- `backend/learned_fusion.py`
- `backend/schemas.py`
- `backend/v2.py`
- `docs/ADVANCED_CLASSIFICATION_AUDIT.md`
- `docs/ARCHITECTURE.md`
- `docs/BASELINE_AUDIT.md`
- `docs/CHANGELOG_IMPLEMENTATION.md`
- `docs/DATASETS.md`
- `docs/DEPLOYMENT.md`
- `docs/EVALUATION.md`
- `docs/MODELS.md`
- `docs/MULTIMODAL_PIPELINES.md`
- `docs/SECURITY.md`
- `frontend/analysis-summary.tsx`
- `frontend/classification-dashboard.tsx`
- `frontend/file-format.ts`
- `frontend/globals.css`
- `frontend/media-findings.tsx`
- `frontend/media-input.tsx`
- `frontend/media-types.ts`
- `frontend/media.worker.ts`
- `frontend/page.tsx`
- `frontend/speech-audio.ts`
- `frontend/theme-toggle.tsx`
- `requirements-tracking.txt`
- `scripts/multimodal_data.py`
- `scripts/predict_multimodal.py`
- `scripts/train_multimodal.py`
- `tests/browser/classification.spec.ts`
- `tests/test_multimodal_training.py`
- `tests/test_v2.py`
- `tests/unit/file-format.test.mjs`

## Publication preparation

The resumed release audit, eleven-phase completion counts, numerical model results and production publication record are maintained in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md). Additional dataset validation now rejects malformed records/encoders/archives and screens huge finite embeddings using float64 to prevent norm-overflow overlap bypass. Ten regression cases were added; the updated complete Python suite passed 81 tests with one opt-in checkpoint skip.

## Additional publication files

- `.github/workflows/production-smoke.yml`: include standalone real audio in optional model checks.
- `app/layout.tsx`: classify-first browser title/description.
- `frontend/README.md`: document dashboard, audio decoding and theme components.
- `docs/IMPLEMENTATION_STATUS.md`: eleven-phase audit, actual metrics and verified release record.

Production verification: 22 desktop/mobile regressions passed with 16 opt-in skips, plus three actual audio/OCR/video-frame integrations passed. GitHub main CI passed. See the publication record for commands, deployment identifier, source commit and limitations.
