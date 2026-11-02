# Evaluation protocols

Primary artifacts: `models/metrics.json`, `models/robustness.json`, and executed experiment reports in `reports/`. All dashboard values come from measured JSON, not fabricated accuracy constants.

The preserved baseline uses a seeded normalized-headline group split, train-only TF-IDF fitting, and validation-only sigmoid calibration. Additional experiments retrain separately and do not replace production weights. Chronological partitions keep dates apart and remove later repeated headline groups. Lexical overlap diagnostics use train-fitted TF-IDF cosine with a declared 0.85 cutoff. The optional semantic experiment groups a declared sampled subset using embeddings; it does not imply all articles were semantically deduplicated.

Measurements now include per-class precision/recall/F1, ROC-AUC and real-class PR-AUC, plus 200-resample seeded bootstrap accuracy/macro-F1 intervals and Wilson accuracy intervals. Bootstrap intervals can degenerate on a tiny error-free set; Wilson intervals and the sample size must be read alongside them. These within-split intervals do not model publisher/event dependence.

Report accuracy together with balanced accuracy, macro F1, class counts, confusion matrices, calibration/Brier/ECE, reliability bins, coverage, and protocol limitations. Headline-only inputs and selected source-cue removal, sensational prefixes, irrelevant source markers, and deterministic wording substitutions are separate stress tests. They do not automatically establish paraphrase robustness or unknown-publisher accuracy.

Transformer pilots use the same sampled train/calibration/test partitions for newly trained classical baselines, record immutable model revisions, tokenize only after partitioning, and measure artifact size and local batched inference. Tiny pilots and batch-derived latency are not full model-selection benchmarks or end-to-end service latency. The original production model was trained on more examples, so its headline number is not a matched pilot comparison.

Publisher and independent-corpus evaluation require appropriate new metadata/data. Trained Hindi veracity, NLI factual verification, CLIP authenticity, deepfake detection, and population-level OCR/ASR accuracy are not established by integration tests. Deterministic wording substitutions are not a human-validated paraphrase benchmark. Full fine-tuning of the three candidate models has not been executed as an independent-source benchmark.

A functional real-model check shows execution and specific expected examples only.

The continuation's deterministic research API tests use synthetic manifest bytes and stub predictions only to test API contracts, checksum rejection, lazy caching, single-slot concurrency, safe failures and language/length abstention. They are not model evaluation. Run actual local-checkpoint inference separately with `VERITY_TEST_RESEARCH_MODEL_DIR=.artifacts/distilbert-base-uncased .venv/bin/python -m pytest tests/test_research.py -q -k actual_local`; it verifies real tokenizer/model loading and response behavior without downloading or training. No additional accuracy is claimed.

Evidence tests cover exact-quote deduplication, offsets, missing/invalid/future publication dates, timezone conversion and the 365/366-day review boundary. The publication-age rule is not a learned relevance or factual-verification threshold.

Connected media rules have deterministic Node unit tests (`npm run test:unit`) for paired-description matching, unvalidated margin boundaries, invalid scores, time alignment, negation/topic flags, missing modalities, excerpt limits and full-clip sampling. They validate rule execution, not detection accuracy. `tests/browser/multimodal.spec.ts` explicitly uses synthetic worker/source fixtures and saved metadata to verify discovery/retrieval, failure states, contradictions, media-context exports, print visibility and timeline navigation. The opt-in existing CLIP/NLI/OCR/Whisper checks use actual downloaded models separately. None establishes population-level visual mismatch, OCR/ASR, factual verification or deepfake accuracy. Production model parameters and evaluation artifacts remain unchanged.

```sh
.venv/bin/python scripts/evaluate.py
.venv/bin/python scripts/audit_data.py --semantic --limit 500
.venv/bin/python -m pytest tests -q
npm run build
npm run typecheck
npm run test:e2e
RESEARCH_INTEGRATION=1 MEDIA_INTEGRATION=1 npm run test:e2e -- --workers=1
```

Real-model checks are opt-in because they need network access, model memory and public fixtures. CI uses deterministic provider boundaries, with failures and unavailable services tested explicitly. An interrupted long-running integration is not recorded as a pass.

## Classification upgrade — 2026-11-02

Fusion tests execute one epoch of actual early/late/attention optimization on seeded synthetic vectors, calibration, held-out metric computation, checkpoint export/reload, masking invariance and checksum rejection. These synthetic labels provide no misinformation accuracy evidence. Existing production metrics and splits remain unchanged. The browser suite additionally covers audio validation and real silent-WAV decoding; a separate `MEDIA_INTEGRATION=1` case exercises actual Whisper transcription.
