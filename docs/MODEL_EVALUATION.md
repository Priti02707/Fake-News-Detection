# Fake News Detection — evaluation register

Phase 0 performs no model training and claims no new benchmark. Existing production results remain recorded in [models/metrics.json](../models/metrics.json), [MODEL_CARD.md](../MODEL_CARD.md) and [EVALUATION.md](EVALUATION.md).

| Existing experiment | Scope | Evidence / promotion status |
| --- | --- | --- |
| LR and Linear SVM | 1,993 held-out English articles; 5,977 training and 1,994 calibration | Recorded historical accuracy 99.05% / 99.90%; macro-F1 .9905 / .9990. Not independent modern-news or worldwide verification accuracy. Weights unchanged by this release. |
| Transformer pilots | Tiny frozen-encoder DistilBERT/RoBERTa/DeBERTa experiments | `reports/transformer-*.json`; not promoted; too small to establish generalization/calibration |
| Temporal / semantic stress tests | Declared historical-data partitions/samples | `models/robustness.json`, `reports/semantic-holdout.json`; preserve declared sampling limits |
| Fusion training code | Offline early/late/attention algorithms and synthetic execution fixtures | No reviewed paired-corpus production release or measured real-world fusion accuracy |
| Factual assessment / Hindi / forensic media | Separate tasks | No independently validated production release; unavailable, not 0% or fabricated metrics |

## Next evaluation protocol

Record dataset origin/rights, row IDs/hashes, labels, language, publisher/date/near-duplicate and shared-image groups, independent train/calibration/test splits and seed. Fit preprocessing only on training data. Select on validation; evaluate once on held-out test. Report accuracy, per-class precision/recall, macro-F1, confusion matrix, AUROC only with both classes and suitable scores, Brier/ECE/reliability bins, abstention coverage, p50/p95 latency and peak memory on a named device. Hindi/mixed-language results must be separate.

For evidence, create independently human-reviewed claim/source/citation labels, evaluate extraction, retrieval relevance, quotation fidelity, factual assessment and failure handling separately. Dates and source independence need explicit reviewer rules. Test prompt injection as untrusted evidence. For fusion, compare text/image/video baselines and ablations on the same disjoint paired test examples. Preserve artifact checksums, encoder revisions, manifests, commands and model licenses. Missing corpus/checkpoint means unmeasured or unavailable, not a replacement score. `backend/registry.py` supplies existing promotion gates; meeting those gates does not authorize automatic promotion.
