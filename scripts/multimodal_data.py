"""Reviewed paired-embedding dataset contract; no media downloading or label guessing."""
import hashlib
import json
from pathlib import Path
import numpy as np

MODALITIES = ("text", "image", "video", "audio")


def load_dataset(features_path, manifest_path):
    manifest = json.loads(Path(manifest_path).read_text())
    if not isinstance(manifest, dict):
        raise ValueError("The dataset manifest must be a JSON object.")
    if manifest.get("task") != "multimodal_news_classification":
        raise ValueError("Declare the multimodal_news_classification task; do not merge unrelated verification/forensic labels.")
    if manifest.get("license_reviewed") is not True or not manifest.get("license") or not manifest.get("source_url"):
        raise ValueError("A reviewed license and source URL are required for the paired data and its media/features.")
    if manifest.get("label_mapping") != {"0": "fake", "1": "real"}:
        raise ValueError("Declare dataset labels 0=fake, 1=real.")
    raw = Path(features_path).read_bytes()
    checksum = hashlib.sha256(raw).hexdigest()
    if manifest.get("features_sha256") != checksum:
        raise ValueError("Feature data checksum does not match the reviewed manifest.")
    encoders = manifest.get("encoders", {})
    if not isinstance(encoders, dict) or set(encoders) - set(MODALITIES):
        raise ValueError("Declare only supported text/image/video/audio encoders.")
    modalities = [name for name in MODALITIES if name in encoders]
    if len(modalities) < 2:
        raise ValueError("At least two declared modalities are required for multimodal training.")
    records = manifest.get("examples", [])
    if not isinstance(records, list) or any(not isinstance(row, dict) or not isinstance(row.get("id"), str) or not row["id"].strip() for row in records):
        raise ValueError("Each paired example requires a nonempty string id.")
    n = len(records)
    if n < 12 or len({row["id"] for row in records}) != n:
        raise ValueError("Provide at least 12 uniquely identified paired examples.")
    partitions = {name: np.array([index for index, row in enumerate(records) if row.get("split") == name]) for name in ("train", "validation", "test")}
    if sum(len(value) for value in partitions.values()) != n or any(len(value) < 4 for value in partitions.values()):
        raise ValueError("Declare train/validation/test splits with at least four examples each.")
    for field in ("publisher", "duplicate_group"):
        if any(not isinstance(row.get(field), str) or not row[field].strip() for row in records):
            raise ValueError(f"Each example requires a {field}.")
        groups = {name: {records[index][field] for index in indices} for name, indices in partitions.items()}
        if any(groups[a] & groups[b] for a, b in (("train", "validation"), ("train", "test"), ("validation", "test"))):
            raise ValueError(f"Split leakage: {field} crosses partitions.")
    with np.load(features_path, allow_pickle=False) as archive:
        if not {"labels", "mask", *modalities} <= set(archive.files):
            raise ValueError("Feature archive must contain labels, mask and all declared modalities.")
        labels, mask = archive["labels"], archive["mask"]
        if labels.shape != (n,) or not np.issubdtype(labels.dtype, np.integer) or not set(labels.tolist()) <= {0, 1}:
            raise ValueError("Feature labels must be a binary integer vector aligned with the manifest.")
        if mask.shape != (n, len(modalities)) or not np.isin(mask, [0, 1]).all() or not np.all(mask.sum(axis=1) >= 1):
            raise ValueError("Modality mask must be binary and each example must have an observed modality.")
        mask = mask.astype(bool)
        features = {}
        for column, name in enumerate(modalities):
            encoder = encoders[name]
            if not isinstance(encoder, dict) or any(not isinstance(encoder.get(key), str) or not encoder[key].strip() for key in ("model", "revision")):
                raise ValueError("Record each feature encoder's model and immutable revision/checksum.")
            values = archive[name].astype(np.float32)
            if values.ndim != 2 or values.shape[0] != n or not 1 <= values.shape[1] <= 2048 or not np.isfinite(values).all():
                raise ValueError("Features must be finite N×D arrays with at most 2048 dimensions.")
            if not mask[partitions["train"], column].any() or np.any(np.linalg.norm(values[mask[:, column]].astype(np.float64), axis=1) == 0):
                raise ValueError("Observed features must be nonzero and each declared modality must occur in training.")
            features[name] = values
    if any(np.unique(labels[indices]).size != 2 for indices in partitions.values()):
        raise ValueError("Every split needs both dataset labels for calibration and evaluation.")
    # Screen observed encoder vectors across every pair of partitions. This is
    # conservative embedding overlap screening, not authenticated data provenance.
    threshold = manifest.get("near_duplicate_cosine_threshold", .995)
    if not isinstance(threshold, (int, float)) or not .8 <= threshold <= 1:
        raise ValueError("Declare an embedding overlap threshold in [0.8, 1].")
    for column, name in enumerate(modalities):
        vectors = features[name].astype(np.float64)
        normalized = vectors / np.maximum(np.linalg.norm(vectors, axis=1, keepdims=True), 1e-12)
        for a, b in (("train", "validation"), ("train", "test"), ("validation", "test")):
            left = partitions[a][mask[partitions[a], column]]
            right = partitions[b][mask[partitions[b], column]]
            for start in range(0, len(left), 128):
                for other in range(0, len(right), 1024):
                    if np.any(normalized[left[start:start + 128]] @ normalized[right[other:other + 1024]].T >= threshold):
                        raise ValueError(f"Potential near-duplicate {name} embeddings cross {a}/{b}; regroup or review before training.")
    normalization, normalized = {}, {}
    for column, name in enumerate(modalities):
        training = features[name][partitions["train"]][mask[partitions["train"], column]].astype(np.float64)
        mean, std = training.mean(axis=0), np.maximum(training.std(axis=0), 1e-6)
        normalization[name] = {"mean": mean.tolist(), "std": std.tolist()}
        with np.errstate(over="ignore", invalid="ignore"):
            normalized[name] = np.where(mask[:, column, None], (features[name] - mean) / std, 0).astype(np.float32)
        if not np.isfinite(normalized[name]).all():
            raise ValueError("Normalized features overflow float32; review encoder output scaling.")
    return {"manifest": manifest, "features": normalized, "labels": labels, "mask": mask, "partitions": partitions, "normalization": normalization, "sha256": checksum}
