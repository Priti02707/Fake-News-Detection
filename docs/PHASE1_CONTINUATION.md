# Phase 1 continuation audit and acceptance plan

Starting revision: `0bc7a38`, clean `main`, 2026-11-01. Work continues on `feature/phase1-research-inference`. The prior release and deployment remain recorded in `CHANGELOG_IMPLEMENTATION.md`; this is an incremental implementation, not a restart.

## Inspected implementation

- Next.js editorial UI, local OCR/Whisper, frame sampling, image comparison, claim notebook and NLI workers already exist. Their opt-in integration checks establish execution, not domain accuracy.
- FastAPI legacy/v2 routes, public-IP-pinned extraction, provider search, citations, request limits, portable models, research scripts, tests, CI and Vercel configuration are present.
- Production LR/SVM parameters are preserved. Transformer pilots and local checkpoints exist, but `TransformerChallenger` has no API, artifact verification or tested load-failure/concurrency contract.
- Evidence retrieval preserves excerpts and dates but repeats identical passages and does not flag missing/old/future publication dates. Publication metadata is source-reported, not authenticated.
- Google search needs an owner key. No independent-source transformer evaluation, validated Hindi classifier, factual-verification calibration, visual forensics or deepfake benchmark exists. Those results cannot be invented.

Baseline: `.venv/bin/python -m pytest tests -q` — **42 passed**, one upstream Starlette deprecation warning. The previous turn's build/type checks passed; rerun them after this phase. Local saved pilots have 64/32/32 train/calibration/test examples and remain unsuitable for promotion.

## Prioritized implementation and acceptance criteria

1. `backend/challenger.py`: verify evaluation metadata and listed checkpoint checksums before importing heavy libraries; load local safetensors only. Reject damaged artifacts. Keep all outputs research-only and expose model/revision/token limits.
2. `backend/research_api.py`: a separately launched optional local API with typed outputs, lazy loading, a single inference slot, short/non-English abstention, safe unavailable responses and no automatic downloads. The Vercel entry point must not import it.
3. `backend/investigation.py`, `backend/main.py`, `app/investigation.tsx`: deduplicate repeated source passages while preserving original offsets; attach publication-date review warnings, display and export them. Warnings never determine support/refutation.
4. `tests/test_research.py`, evidence/API/browser tests: cover missing configuration, missing/corrupt artifacts, concurrency, language/length guards, citation integrity and date boundaries. Run actual saved-checkpoint inference separately from mocked API tests.
5. README, model card, architecture/model/evaluation/security/deployment notes: document the exact optional command, limitations and measured checks. Preserve production model hashes and legacy routes.

No production promotion, new paid API, model download or heavyweight Vercel inference is required. Subsequent media phases will build on the existing implementation after Phase 1 is validated. Production publication requires the authorization specified in the latest task instructions.

## Implemented outcome and validation

Implemented the five items above. An actual saved-checkpoint test initially failed verification because old benchmark reruns had hashed the previous `evaluation.json`, then overwritten it. All model/tokenizer files matched their hashes. Future reports exclude that self-reference; the loader ignores the legacy self-entry while continuing to validate every other listed artifact. A regression test covers that compatibility behavior. No weights or recorded model metrics were modified.

- `.venv/bin/python -m pytest tests -q`: **62 passed, 1 skipped**, one existing upstream Starlette deprecation warning. The skipped case is the explicitly opt-in real checkpoint test.
- `VERITY_TEST_RESEARCH_MODEL_DIR=.artifacts/distilbert-base-uncased .venv/bin/python -m pytest tests/test_research.py -q -k actual_local`: **1 passed**, using real local safetensors/tokenizer and the research API. No download or new training; this is not an accuracy benchmark.
- `npm run build`: passed. Also built with `API_ORIGIN=http://127.0.0.1:8011` for isolated local browser checks.
- `npm run typecheck`: passed.
- `playwright test` with a temporary configuration pointing at the production build on local port 3011 and fresh FastAPI on 8011: **12 passed, 12 skipped** across desktop/mobile. Tests cover original article/media-upload workflows, citations, exports, unknown/old date notes and source discovery. Network-heavy OCR/ASR/NLI/CLIP/C2PA cases were not rerun.

Changed files: `.env.example`, `MODEL_CARD.md`, `README.md`, `app/investigation.tsx`, `backend/challenger.py`, `backend/investigation.py`, `backend/main.py`, `backend/research_api.py`, `docs/ARCHITECTURE.md`, `docs/CHANGELOG_IMPLEMENTATION.md`, `docs/DEPLOYMENT.md`, `docs/EVALUATION.md`, `docs/MODELS.md`, `docs/PHASE1_CONTINUATION.md`, `docs/SECURITY.md`, `scripts/benchmark_transformers.py`, `tests/browser/investigation.spec.ts`, `tests/test_investigation.py`, `tests/test_research.py`.

Remaining: no independent-source transformer benchmark or production promotion, no new Hindi veracity model, no newly validated NLI factual accuracy, and no public research inference hosting. Existing browser NLI continues to provide experimental textual suggestions; claim verification remains insufficient without explicitly attributed reader review. Date age never determines a factual verdict. This phase was not deployed at this checkpoint; it was subsequently included in the [connected multimodal production release](MULTIMODAL_RELEASE.md). The optional local research service remains separate from Vercel.
