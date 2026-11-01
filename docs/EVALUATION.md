# Evaluation protocols

Primary artifacts: `models/metrics.json`, `models/robustness.json`, and executed experiment reports in `reports/`. All dashboard values come from measured JSON, not fabricated accuracy constants.

The preserved baseline uses a seeded normalized-headline group split, train-only TF-IDF fitting, and validation-only sigmoid calibration. Additional experiments retrain separately and do not replace production weights. Chronological partitions keep dates apart and remove later repeated headline groups. Lexical overlap diagnostics use train-fitted TF-IDF cosine with a declared 0.85 cutoff. The optional semantic experiment groups a declared sampled subset using embeddings; it does not imply all articles were semantically deduplicated.

Measurements now include per-class precision/recall/F1, ROC-AUC and real-class PR-AUC, plus 200-resample seeded bootstrap accuracy/macro-F1 intervals and Wilson accuracy intervals. Bootstrap intervals can degenerate on a tiny error-free set; Wilson intervals and the sample size must be read alongside them. These within-split intervals do not model publisher/event dependence.

Report accuracy together with balanced accuracy, macro F1, class counts, confusion matrices, calibration/Brier/ECE, reliability bins, coverage, and protocol limitations. Headline-only inputs and selected source-cue removal, sensational prefixes, irrelevant source markers, and deterministic wording substitutions are separate stress tests. They do not automatically establish paraphrase robustness or unknown-publisher accuracy.

Transformer pilots use the same sampled train/calibration/test partitions for newly trained classical baselines, record immutable model revisions, tokenize only after partitioning, and measure artifact size and local batched inference. Tiny pilots and batch-derived latency are not full model-selection benchmarks or end-to-end service latency. The original production model was trained on more examples, so its headline number is not a matched pilot comparison.

Publisher and independent-corpus evaluation require appropriate new metadata/data. Trained Hindi veracity, NLI factual verification, CLIP authenticity, deepfake detection, and population-level OCR/ASR accuracy are not established by integration tests. Deterministic wording substitutions are not a human-validated paraphrase benchmark. Full fine-tuning of the three candidate models has not been executed as an independent-source benchmark.

A functional real-model check shows execution and specific expected examples only.

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
