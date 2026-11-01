"""Configurable local transformer benchmark. Does not promote or overwrite baselines."""
import argparse
import hashlib
import json
import os
import platform
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.evaluate import load_data, measure, run_experiment
from scripts.data_pipeline import prepare_articles
from backend.registry import promotion_decision, file_sha256


def subset(indices, labels, maximum, seed):
    import numpy as np
    from sklearn.model_selection import train_test_split
    if maximum is None or len(indices) <= maximum: return indices
    chosen, _ = train_test_split(indices, train_size=maximum, stratify=labels, random_state=seed)
    return np.asarray(chosen)


def benchmark(config, model_name, fake, real, output):
    import numpy as np
    import torch
    import transformers
    from huggingface_hub import model_info
    from transformers import AutoTokenizer, AutoModelForSequenceClassification
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import GroupShuffleSplit
    torch.set_num_threads(min(4, os.cpu_count() or 1))
    seed = int(config.get("seed", 42)); random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)
    data, data_audit = prepare_articles(fake, real)
    rest, test = next(GroupShuffleSplit(n_splits=1, test_size=.2, random_state=42).split(data, groups=data.group))
    train_rel, calibration_rel = next(GroupShuffleSplit(n_splits=1, test_size=.25, random_state=43).split(data.iloc[rest], groups=data.iloc[rest].group))
    partitions = [rest[train_rel], rest[calibration_rel], test]
    partitions = [subset(indices, data.iloc[indices].label, config.get(key), seed + index) for index, (indices, key) in enumerate(zip(partitions, ["max_train", "max_calibration", "max_test"]))]
    train, calibration, test = partitions
    assert all(set(data.iloc[a].group).isdisjoint(data.iloc[b].group) for a, b in [(train, calibration), (train, test), (calibration, test)])
    revision = config.get("revision") or model_info(model_name).sha
    cache = ROOT / ".cache/huggingface"
    tokenizer = AutoTokenizer.from_pretrained(model_name, revision=revision, cache_dir=cache, trust_remote_code=False)
    model = AutoModelForSequenceClassification.from_pretrained(model_name, revision=revision, num_labels=2, cache_dir=cache, trust_remote_code=False)
    requested = config.get("device", "auto")
    device = "cuda" if requested == "auto" and torch.cuda.is_available() else "cpu" if requested == "auto" else requested
    model.to(device)
    if config.get("freeze_encoder"):
        for parameter in model.base_model.parameters(): parameter.requires_grad = False
    optimizer = torch.optim.AdamW((parameter for parameter in model.parameters() if parameter.requires_grad), lr=float(config["learning_rate"]))
    batch_size = int(config["batch_size"])
    started = time.perf_counter()
    for epoch in range(int(config["epochs"])):
        model.train()
        shuffled = np.random.default_rng(seed + epoch).permutation(train)
        losses = []
        for start in range(0, len(shuffled), batch_size):
            indices = shuffled[start:start + batch_size]
            encoded = tokenizer(data.iloc[indices].content.tolist(), padding=True, truncation=True, max_length=int(config["max_length"]), return_tensors="pt").to(device)
            labels = torch.tensor(data.iloc[indices].label.tolist(), dtype=torch.long, device=device)
            optimizer.zero_grad(set_to_none=True)
            loss = model(**encoded, labels=labels).loss; loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.)
            optimizer.step(); losses.append(float(loss.detach().cpu()))
        print(json.dumps({"model": model_name, "epoch": epoch + 1, "training_loss": float(np.mean(losses))}), flush=True)
    training_seconds = time.perf_counter() - started
    model.eval()
    def score(indices):
        values, latencies = [], []
        with torch.no_grad():
            for start in range(0, len(indices), batch_size):
                rows = indices[start:start + batch_size]
                before = time.perf_counter()
                inputs = tokenizer(data.iloc[rows].content.tolist(), padding=True, truncation=True, max_length=int(config["max_length"]), return_tensors="pt").to(device)
                logits = model(**inputs).logits.detach().cpu().numpy()
                values.extend((logits[:, 1] - logits[:, 0]).tolist())
                latencies.append((time.perf_counter() - before) * 1000 / len(rows))
        return np.array(values), latencies
    val_scores, _ = score(calibration)
    calibrator = LogisticRegression(C=1, max_iter=2000, random_state=seed).fit(val_scores.reshape(-1, 1), data.iloc[calibration].label)
    test_scores, latencies = score(test)
    probabilities = calibrator.predict_proba(test_scores.reshape(-1, 1))[:, 1]
    metrics = measure(data.iloc[test].label, probabilities)
    single_latencies = []
    with torch.no_grad():
        for text in data.iloc[test[:32]].content:
            if device == "cuda": torch.cuda.synchronize()
            before = time.perf_counter()
            inputs = tokenizer(text, truncation=True, max_length=int(config["max_length"]), return_tensors="pt").to(device)
            model(**inputs)
            if device == "cuda": torch.cuda.synchronize()
            single_latencies.append((time.perf_counter() - before) * 1000)
    output.mkdir(parents=True, exist_ok=True)
    model.to("cpu").save_pretrained(output, safe_serialization=True); tokenizer.save_pretrained(output)
    artifacts = {str(path.relative_to(output)): {"sha256": file_sha256(path), "bytes": path.stat().st_size} for path in output.rglob("*") if path.is_file() and path.name != "evaluation.json"}
    comparable_baselines = run_experiment(data, tuple(partitions), "Same transformer benchmark partitions")
    production = json.loads((ROOT / "models/metrics.json").read_text())["models"][1]
    report = {"schema_version": 1, "model": model_name, "revision": revision, "trained_at": datetime.now(timezone.utc).isoformat(), "config": config, "device": device, "training_seconds": training_seconds, "splits": {name: len(indices) for name, indices in zip(["train", "calibration", "test"], partitions)}, "partition_hashes": {name: hashlib.sha256("\n".join(sorted(data.iloc[indices].key)).encode()).hexdigest() for name, indices in zip(["train", "calibration", "test"], partitions)}, "versions": {"python": platform.python_version(), "torch": torch.__version__, "transformers": transformers.__version__}, "source_sha256": {path.name: file_sha256(path) for path in [fake, real]}, "calibration": {"method": "Sigmoid fitted on the separate calibration partition", "coefficient": float(calibrator.coef_[0, 0]), "intercept": float(calibrator.intercept_[0]), "production_validated": False}, "metrics": metrics, "latency": {"single_request_samples": len(single_latencies), "mean_single_request_ms": float(np.mean(single_latencies)), "p95_single_request_ms": float(np.quantile(single_latencies, .95)), "mean_ms_per_article_in_batch": float(np.mean(latencies)), "p95_ms_per_article_in_batch": float(np.quantile(latencies, .95)), "includes_tokenization": True, "excludes_download_and_cold_start": True}, "artifact_bytes": sum(item["bytes"] for item in artifacts.values()), "artifacts": artifacts, "same_partition_baselines": comparable_baselines, "deployment_status": "research_only", "limitations": ["A small smoke configuration only verifies pipeline execution; it is not a defensible model-selection benchmark.", "Historical corpus with unresolved source provenance; no claim-level FEVER/LIAR labels were merged into article labels.", "Grouped splits do not guarantee independent publishers or semantic deduplication.", "No automatic model promotion. Production calibration and external-source performance are not validated."]}
    report["promotion"] = promotion_decision({"test_examples": len(test), "independent_source_evaluation": False, "same_test_set_as_baseline": False, "macro_f1": metrics["macro_f1"], "brier_score": metrics["brier_score"], "p95_latency_ms": report["latency"]["p95_single_request_ms"]}, production)
    report["data_audit"] = data_audit
    (output / "evaluation.json").write_text(json.dumps(report, indent=2))
    destination = ROOT / "reports"; destination.mkdir(exist_ok=True)
    (destination / f"transformer-{model_name.split('/')[-1]}.json").write_text(json.dumps(report, indent=2))
    print(json.dumps({"model": model_name, "splits": report["splits"], "metrics": {key: metrics[key] for key in ["accuracy", "macro_f1", "brier_score"]}, "promotion": report["promotion"]}), flush=True)
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=ROOT / "configs/transformer-smoke.json")
    parser.add_argument("--model")
    parser.add_argument("--fake", type=Path, default=ROOT / "data/Fake.csv")
    parser.add_argument("--real", type=Path, default=ROOT / "data/True.csv")
    args = parser.parse_args()
    settings = json.loads(args.config.read_text())
    candidates = [args.model] if args.model else settings.get("candidates", [settings.get("model")])
    for candidate in candidates:
        if not candidate: raise ValueError("A model identifier is required.")
        try:
            benchmark({**settings, "model": candidate}, candidate, args.fake, args.real, ROOT / ".artifacts" / candidate.split("/")[-1])
        except Exception as error:
            destination = ROOT / "reports"; destination.mkdir(exist_ok=True)
            failure = {"model": candidate, "status": "not_completed", "error_type": type(error).__name__, "reason": str(error).split("\\n")[0][:400], "metrics": None, "production_changed": False}
            (destination / f"transformer-{candidate.split('/')[-1]}-unavailable.json").write_text(json.dumps(failure, indent=2))
            print(json.dumps(failure), flush=True)
