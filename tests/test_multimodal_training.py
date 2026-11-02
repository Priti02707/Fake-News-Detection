"""Synthetic execution/validation fixtures. These are not fake-news benchmarks."""
import hashlib
import json
from pathlib import Path
import importlib.util
import numpy as np
import pytest

from scripts.multimodal_data import load_dataset


def fixture(tmp_path):
    rng = np.random.default_rng(73)
    features = tmp_path / "synthetic.npz"
    np.savez(features, text=rng.normal(size=(36, 16)).astype("float32"), image=rng.normal(size=(36, 8)).astype("float32"), labels=np.arange(36) % 2, mask=np.ones((36, 2), dtype=bool))
    manifest = {"task": "multimodal_news_classification", "source_url": "https://example.com/synthetic-unit-test", "license": "Original synthetic test numbers only", "license_reviewed": True, "label_mapping": {"0": "fake", "1": "real"}, "features_sha256": hashlib.sha256(features.read_bytes()).hexdigest(), "encoders": {"text": {"model": "synthetic", "revision": "seed-73"}, "image": {"model": "synthetic", "revision": "seed-73"}}, "examples": [{"id": str(index), "publisher": f"synthetic-source-{index // 12}", "duplicate_group": str(index), "split": ("train", "validation", "test")[index // 12]} for index in range(36)]}
    path = tmp_path / "manifest.json"; path.write_text(json.dumps(manifest))
    return features, path, manifest


def test_paired_data_requires_reviewed_license_and_recorded_checksums(tmp_path):
    features, path, manifest = fixture(tmp_path)
    result = load_dataset(features, path)
    assert result["partitions"]["test"].size == 12
    manifest["license_reviewed"] = False; path.write_text(json.dumps(manifest))
    with pytest.raises(ValueError, match="license"):
        load_dataset(features, path)
    manifest["license_reviewed"] = True; manifest["features_sha256"] = "wrong"; path.write_text(json.dumps(manifest))
    with pytest.raises(ValueError, match="checksum"):
        load_dataset(features, path)


@pytest.mark.parametrize("field", ["publisher", "duplicate_group"])
def test_paired_data_rejects_cross_split_leakage(tmp_path, field):
    features, path, manifest = fixture(tmp_path)
    manifest["examples"][12][field] = manifest["examples"][0][field]
    path.write_text(json.dumps(manifest))
    with pytest.raises(ValueError, match="leakage"):
        load_dataset(features, path)


def test_paired_data_rejects_embedding_duplicates_even_with_different_groups(tmp_path):
    features, path, manifest = fixture(tmp_path)
    with np.load(features) as data:
        arrays = {key: data[key] for key in data.files}
    arrays["text"][12] = arrays["text"][0]
    np.savez(features, **arrays)
    manifest["features_sha256"] = hashlib.sha256(features.read_bytes()).hexdigest(); path.write_text(json.dumps(manifest))
    with pytest.raises(ValueError, match="near-duplicate"):
        load_dataset(features, path)


def test_paired_data_normalization_fits_only_training_rows(tmp_path):
    features, path, _ = fixture(tmp_path)
    result = load_dataset(features, path)
    assert np.allclose(result["features"]["text"][:12].mean(0), 0, atol=1e-6)


@pytest.mark.parametrize("invalid", ["not_object", "missing_id", "empty_id", "unknown_encoder", "bad_encoder", "bad_examples"])
def test_paired_manifest_rejects_malformed_records(tmp_path, invalid):
    features, path, manifest = fixture(tmp_path)
    if invalid == "not_object": manifest = []
    elif invalid == "missing_id": del manifest["examples"][0]["id"]
    elif invalid == "empty_id": manifest["examples"][0]["id"] = " "
    elif invalid == "unknown_encoder": manifest["encoders"]["typo"] = {}
    elif invalid == "bad_encoder": manifest["encoders"]["text"] = None
    else: manifest["examples"] = {}
    path.write_text(json.dumps(manifest))
    with pytest.raises(ValueError):
        load_dataset(features, path)


@pytest.mark.parametrize("invalid", ["missing_array", "nan", "all_missing", "large_duplicates"])
def test_paired_features_reject_invalid_arrays_and_large_duplicate_vectors(tmp_path, invalid):
    features, path, manifest = fixture(tmp_path)
    with np.load(features) as data:
        arrays = {key: data[key] for key in data.files}
    if invalid == "missing_array": del arrays["image"]
    elif invalid == "nan": arrays["text"][0, 0] = np.nan
    elif invalid == "all_missing": arrays["mask"][0] = False
    else:
        # Float32 norm overflows for these finite vectors. Screening must still
        # detect overlap rather than silently compare zero-normalized vectors.
        arrays["text"][0] *= 1e25
        arrays["text"][12] = arrays["text"][0]
    np.savez(features, **arrays)
    manifest["features_sha256"] = hashlib.sha256(features.read_bytes()).hexdigest()
    path.write_text(json.dumps(manifest))
    with pytest.raises(ValueError):
        load_dataset(features, path)


@pytest.mark.skipif(importlib.util.find_spec("torch") is None, reason="Optional local PyTorch research dependency.")
def test_actual_fusion_optimization_artifacts_and_offline_inference(tmp_path):
    import torch
    from backend.learned_fusion import MultimodalClassifier
    from scripts.train_multimodal import train
    from scripts.predict_multimodal import predict
    features, path, _ = fixture(tmp_path)
    output = tmp_path / "research-run"
    report = train(features, path, output, epochs=1, hidden=8)
    assert set(report["models"]) == {"early", "late", "attention"}
    assert report["automatic_promotion"] is False
    assert report["training_configuration"]["calibration"] == "validation_only_logistic_regression"
    assert "scikit-learn" in report["versions"]
    assert all(item["metrics"]["n"] == 12 for item in report["models"].values())
    with np.load(features) as data:
        sample = {"text": data["text"][0].tolist(), "image": data["image"][0].tolist()}
    for mode in report["models"]:
        result = predict(output, sample, mode)
        assert result["confidence"] is None and result["verdict"] == "uncertain"
        assert 0 <= result["research_score"] <= 1
        assert (output / f"{mode}.safetensors").is_file()
    # Withheld modality values cannot affect any fusion strategy's output.
    for mode in report["models"]:
        model = MultimodalClassifier({"text": 16, "image": 8}, mode=mode, hidden=8).eval()
        observed = {"text": torch.randn(2, 16), "image": torch.randn(2, 8)}
        mask = torch.tensor([[True, False], [True, False]])
        with torch.no_grad():
            before = model(observed, mask)
            observed["image"] = torch.randn(2, 8) * 10000
            assert torch.allclose(before, model(observed, mask))
        with pytest.raises(ValueError, match="observed"):
            model(observed, torch.zeros(2, 2, dtype=torch.bool))
    with pytest.raises(ValueError, match="never overwritten"):
        train(features, path, output, epochs=1, hidden=8)
    (output / "attention.safetensors").write_bytes(b"damaged")
    with pytest.raises(ValueError, match="checksum"):
        predict(output, sample)
