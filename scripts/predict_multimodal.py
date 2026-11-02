"""Offline research inference for a trained paired-feature fusion checkpoint."""
import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def predict(directory, sample, mode="attention"):
    import math
    import numpy as np
    import torch
    from safetensors.torch import load_file
    from backend.learned_fusion import MultimodalClassifier
    from backend.registry import file_sha256
    directory = Path(directory).resolve(strict=True)
    report = json.loads((directory / "evaluation.json").read_text())
    if report.get("task") != "multimodal_news_classification" or mode not in {"early", "late", "attention"}:
        raise ValueError("Choose a recorded multimodal fusion research model.")
    record = report["models"][mode]
    path = (directory / record["artifact"]["path"]).resolve(strict=True)
    if not path.is_relative_to(directory) or path.suffix != ".safetensors" or file_sha256(path) != record["artifact"]["sha256"]:
        raise ValueError("Fusion checkpoint checksum or artifact path is invalid.")
    dimensions = report["dimensions"]
    if set(sample) - set(dimensions):
        raise ValueError("The sample contains an undeclared modality.")
    features, mask = {}, []
    for name, dimension in dimensions.items():
        values = np.array(sample.get(name, [0.] * dimension), dtype=np.float32)
        if values.shape != (dimension,) or not np.isfinite(values).all():
            raise ValueError("Sample embeddings must match the recorded finite feature dimensions.")
        present = name in sample
        if present and np.linalg.norm(values) == 0:
            raise ValueError("Observed embeddings must be nonzero.")
        normalizer = report["normalization"][name]
        values = (values - np.array(normalizer["mean"])) / np.array(normalizer["std"]) if present else values
        features[name] = torch.tensor(values[None], dtype=torch.float32); mask.append(present)
    if not any(mask):
        raise ValueError("At least one observed modality is required.")
    torch.set_num_threads(min(4, torch.get_num_threads()))
    model = MultimodalClassifier(dimensions, mode=mode, hidden=report["hidden"])
    model.load_state_dict(load_file(path)); model.eval()
    with torch.no_grad():
        logits = model(features, torch.tensor([mask]))[0].tolist()
    calibrated = record["calibration"]["coefficient"] * (logits[1] - logits[0]) + record["calibration"]["intercept"]
    if not math.isfinite(calibrated):
        raise ValueError("The research model produced a nonfinite score.")
    probability = 1 / (1 + math.exp(-max(-35, min(35, calibrated))))
    return {"verdict": "uncertain", "confidence": None, "research_prediction": "real" if probability >= .5 else "fake", "research_score": probability, "deployment_status": "research_only", "modalities": [name for name, present in zip(dimensions, mask) if present], "warning": "Dataset-label research output only. No independently validated production calibration, factual truth, authenticity or automatic promotion is established."}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--sample", type=Path, required=True)
    parser.add_argument("--mode", choices=["early", "late", "attention"], default="attention")
    args = parser.parse_args()
    print(json.dumps(predict(args.checkpoint, json.loads(args.sample.read_text()), args.mode)))
