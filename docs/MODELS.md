# Models and promotion

- **Production:** portable TF-IDF + calibrated Logistic Regression / Linear SVM. Original parameters are preserved. Explanations are signed linear feature contributions, not factual evidence.
- **Research challengers:** configurable DistilBERT, RoBERTa-base, and DeBERTa-v3-base pipelines using optional PyTorch/Hugging Face dependencies. `configs/transformer-pilots.json` performs small frozen-encoder/head-training experiments. `configs/transformer-benchmark.json` configures fuller fine-tuning. A smoke/pilot run is not production validation.
- **Optional browser assistance:** MiniLM semantic ranking, DeBERTa textual entailment, CLIP relative image-description matching, Whisper speech extraction, Tesseract OCR, and the C2PA reader. Immutable Hugging Face revisions are in `models/browser-models.json`; npm versions are locked.

`models/registry.json` records architecture, data/artifact checksums, versions, seed/configuration, split methodology, measured results, timestamps when known, and deployment state. Missing original training timestamps are explicitly null, not invented. Large research artifacts are in ignored `.artifacts/`; no model checkpoint is committed.

Promotion is never automatic. The policy requires at least 500 held-out examples, a matched test-set comparison, independent-source results, no macro-F1/calibration regression, and acceptable target-hardware latency. Current pilots cannot satisfy this policy. No transformer attribution is shown as production explainability because no challenger has been promoted. The existing reliable linear explanations remain available.

Research commands:

```sh
.venv/bin/pip install -r requirements-ml.txt
.venv/bin/python scripts/benchmark_transformers.py --config configs/transformer-pilots.json
.venv/bin/python scripts/benchmark_transformers.py --config configs/transformer-benchmark.json
.venv/bin/python scripts/build_registry.py
```

Experiments pin the resolved model revision, use `trust_remote_code=False`, isolate calibration, record artifact sizes/checksums and library versions, and leave production untouched. Local CPU is supported; `device=auto` can use CUDA when installed. GPU use is optional and not part of the Vercel deployment. See actual JSON files in `reports/` for executed runs and any failures.

## Optional local inference API

`backend.research_api:app` serves `GET /api/research/health` and `POST /api/research/analyze/text` when launched separately. Configure `VERITY_RESEARCH_MODEL_DIR` to a saved benchmark directory; the request cannot choose a path or remote model. Nothing is loaded at startup. The service serializes model load/inference with one nonblocking slot; overload returns 503 with `Retry-After`. Run one process to avoid duplicating model memory.

The loader checks all listed model/tokenizer files' sizes and SHA-256 hashes, requires the local `model.safetensors`, validates calibration parameters/token limits, disables remote code and network loading, and requires two labels. These checks establish agreement with an operator-trusted manifest, not independent provenance or a signed supply chain. An older benchmark rerun bug included the previous `evaluation.json` in its own artifact list. The loader ignores that self-reference while checking all other files; future benchmark reports exclude it. Existing metrics and checkpoints are preserved.

Every response has `verdict: uncertain`, `confidence: null`, `deployment_status: research_only` and `calibration_validated_for_production: false`. A successful English article request adds the dataset-label `research_score`, model, revision and token limit. Short/non-English requests abstain without loading. Missing configuration/checkpoints/dependencies and corrupt artifacts return safe 503 errors. No transformer option appears as a promoted production model in the website.

## Classification upgrade — 2026-11-02

Optional paired-feature early/late/attention models train through `scripts/train_multimodal.py` and load checksummed safetensors through `scripts/predict_multimodal.py`. They use modality masks and training-only normalization; sigmoid calibration fits validation margins only. No production promotion or independently validated fusion accuracy is claimed. See [the dataset contract](ADVANCED_CLASSIFICATION_AUDIT.md).
