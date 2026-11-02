"""Actual optimization of paired-embedding fusion models; no automatic promotion."""
import argparse
import json
from pathlib import Path
import sys
import time
from importlib.metadata import version
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def train(features_path, manifest_path, output, *, epochs=10, hidden=32, seed=42, modes=("early", "late", "attention"), tracking_uri=None):
    import numpy as np
    import torch
    from sklearn.linear_model import LogisticRegression
    from safetensors.torch import save_file
    from backend.learned_fusion import MultimodalClassifier
    from backend.registry import file_sha256
    from scripts.multimodal_data import load_dataset
    from scripts.evaluate import measure

    if not 1 <= epochs <= 1000 or set(modes) - {"early", "late", "attention"} or not modes:
        raise ValueError("Declare valid fusion modes and 1–1000 epochs.")
    if Path(output).exists():
        raise ValueError("Choose a new output directory; existing checkpoints are never overwritten.")
    data = load_dataset(features_path, manifest_path)
    tracking = None
    if tracking_uri:
        import mlflow
        mlflow.set_tracking_uri(tracking_uri)
        mlflow.set_experiment("verity-multimodal-research")
        tracking = mlflow
    torch.set_num_threads(min(4, torch.get_num_threads()))
    dimensions = {name: value.shape[1] for name, value in data["features"].items()}
    features = {name: torch.from_numpy(values) for name, values in data["features"].items()}
    labels = torch.tensor(data["labels"], dtype=torch.long)
    mask = torch.from_numpy(data["mask"])
    partitions = data["partitions"]
    output = Path(output); output.mkdir(parents=True)
    report = {"schema_version": 1, "task": "multimodal_news_classification", "deployment_status": "research_only", "automatic_promotion": False, "created_at": datetime.now(timezone.utc).isoformat(), "features_sha256": data["sha256"], "manifest_sha256": file_sha256(manifest_path), "manifest": data["manifest"], "normalization": data["normalization"], "dimensions": dimensions, "hidden": hidden, "seed": seed, "epochs": epochs, "splits": {name: len(indices) for name, indices in partitions.items()}, "versions": {"torch": torch.__version__, "numpy": np.__version__}, "models": {}, "limitations": ["Feature provenance/licensing and labels are operator-reviewed declarations, not independent authentication.", "Embedding overlap screening does not guarantee publisher/event independence beyond provided metadata.", "No raw-media encoder, Hindi classifier or forensic model is trained by this feature-fusion command.", "Calibration is evaluated on the supplied holdout only; external generalization and production promotion remain unestablished.", "Attention is an internal weighting mechanism, not a causal explanation."]}
    report["versions"].update({"scikit-learn": version("scikit-learn"), "safetensors": version("safetensors")})
    report["training_configuration"] = {"optimizer": "AdamW", "learning_rate": .001, "weight_decay": .01, "batch_size": 32, "gradient_clip_norm": 1., "loss": "cross_entropy", "device": "cpu", "calibration": "validation_only_logistic_regression"}
    for mode in modes:
        torch.manual_seed(seed); np.random.seed(seed)
        model = MultimodalClassifier(dimensions, mode=mode, hidden=hidden)
        optimizer = torch.optim.AdamW(model.parameters(), lr=.001)
        started = time.perf_counter()
        for _ in range(epochs):
            model.train()
            for rows in torch.tensor(partitions["train"])[torch.randperm(len(partitions["train"]))].split(32):
                optimizer.zero_grad(set_to_none=True)
                logits = model({name: value[rows] for name, value in features.items()}, mask[rows])
                loss = torch.nn.functional.cross_entropy(logits, labels[rows]); loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.)
                optimizer.step()
        training_seconds = time.perf_counter() - started
        model.eval()
        def score(rows):
            values, latencies = [], []
            with torch.no_grad():
                for batch in torch.tensor(rows).split(32):
                    before = time.perf_counter()
                    logits = model({name: value[batch] for name, value in features.items()}, mask[batch])
                    values.extend((logits[:, 1] - logits[:, 0]).tolist())
                    latencies.append((time.perf_counter() - before) * 1000 / len(batch))
            return np.array(values), latencies
        validation, _ = score(partitions["validation"])
        calibrator = LogisticRegression(random_state=seed).fit(validation[:, None], data["labels"][partitions["validation"]])
        scores, latency = score(partitions["test"])
        probabilities = calibrator.predict_proba(scores[:, None])[:, 1]
        metrics = measure(data["labels"][partitions["test"]], probabilities)
        path = output / f"{mode}.safetensors"; save_file(model.state_dict(), path)
        report["models"][mode] = {"metrics": metrics, "training_seconds": training_seconds, "mean_fusion_ms_per_example_in_batch": float(np.mean(latency)), "excludes_feature_extraction": True, "calibration": {"coefficient": float(calibrator.coef_[0, 0]), "intercept": float(calibrator.intercept_[0]), "production_validated": False}, "artifact": {"path": path.name, "sha256": file_sha256(path), "bytes": path.stat().st_size}}
        if tracking:
            with tracking.start_run(run_name=mode):
                tracking.log_params({"fusion": mode, "seed": seed, "epochs": epochs, "features_sha256": data["sha256"]})
                tracking.log_metrics({name: float(metrics[name]) for name in ("accuracy", "macro_f1", "brier_score")})
    (output / "evaluation.json").write_text(json.dumps(report, indent=2, allow_nan=False))
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--features", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--tracking-uri")
    args = parser.parse_args()
    report = train(args.features, args.manifest, args.output, epochs=args.epochs, tracking_uri=args.tracking_uri)
    print(json.dumps({"deployment_status": report["deployment_status"], "models": {name: value["metrics"]["macro_f1"] for name, value in report["models"].items()}}))
