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
