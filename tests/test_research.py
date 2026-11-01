import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

import pytest
from fastapi.testclient import TestClient

from backend.challenger import verified_metadata
from backend.research_api import ResearchService, create_app

ARTICLE = (
    "The city council announced a new public transport proposal on Tuesday. "
    "Officials said that the proposal would be open for public comment for thirty days before a final vote. "
    "Residents can submit feedback at a public meeting next month. "
    "The council will publish further details after the meeting."
)


def checkpoint_manifest(tmp_path):
    artifacts = {}
    for name in ("config.json", "tokenizer_config.json", "model.safetensors"):
        content = b"Synthetic checksum fixture; not a real checkpoint."
        (tmp_path / name).write_bytes(content)
        artifacts[name] = {"bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()}
    metadata = {"model": "synthetic-test", "revision": "test-revision", "config": {"max_length": 96}, "calibration": {"coefficient": 1., "intercept": 0.}, "artifacts": artifacts}
    (tmp_path / "evaluation.json").write_text(json.dumps(metadata))
    return metadata


def test_checkpoint_manifest_checks_content_before_model_loading(tmp_path):
    metadata = checkpoint_manifest(tmp_path)
    assert verified_metadata(tmp_path) == metadata
    path = tmp_path / "model.safetensors"
    path.write_bytes(b"X" * path.stat().st_size)
    with pytest.raises(ValueError, match="checksum"):
        verified_metadata(tmp_path)


def test_legacy_report_self_hash_does_not_disable_artifact_verification(tmp_path):
    metadata = checkpoint_manifest(tmp_path)
    metadata["artifacts"]["evaluation.json"] = {"bytes": 1, "sha256": "stale-report-hash"}
    (tmp_path / "evaluation.json").write_text(json.dumps(metadata))
    assert verified_metadata(tmp_path) == metadata
    (tmp_path / "config.json").write_bytes(b"changed")
    with pytest.raises(ValueError, match="checksum"):
        verified_metadata(tmp_path)


def test_checkpoint_manifest_rejects_escaping_paths_and_missing_artifacts(tmp_path):
    directory = tmp_path / "checkpoint"
    directory.mkdir()
    metadata = checkpoint_manifest(directory)
    outside = tmp_path / "outside"
    outside.write_bytes(b"outside")
    metadata["artifacts"]["../outside"] = {"bytes": 7, "sha256": hashlib.sha256(b"outside").hexdigest()}
    (directory / "evaluation.json").write_text(json.dumps(metadata))
    with pytest.raises(ValueError, match="outside"):
        verified_metadata(directory)
    metadata["artifacts"] = {}
    (directory / "evaluation.json").write_text(json.dumps(metadata))
    with pytest.raises(ValueError, match="required"):
        verified_metadata(directory)


@pytest.mark.parametrize("coefficient,maximum", [(float("nan"), 96), (1., 100000), (1., True)])
def test_checkpoint_manifest_rejects_invalid_parameters(tmp_path, coefficient, maximum):
    metadata = checkpoint_manifest(tmp_path)
    metadata["calibration"]["coefficient"] = coefficient
    metadata["config"]["max_length"] = maximum
    (tmp_path / "evaluation.json").write_text(json.dumps(metadata))
    with pytest.raises(ValueError):
        verified_metadata(tmp_path)


def test_unconfigured_research_api_is_explicit_and_does_not_leak_paths():
    client = TestClient(create_app(ResearchService()))
    health = client.get("/api/research/health").json()
    assert health["configured"] is False
    assert health["model_loaded"] is False
    assert health["automatic_downloads"] is False
    response = client.post("/api/research/analyze/text", json={"text": ARTICLE})
    assert response.status_code == 503
    assert "unconfigured" in response.json()["detail"]
    assert response.headers["X-Request-ID"]
    assert client.post("/api/research/analyze/text", json={"text": "x" * 20001}).status_code == 422


@pytest.mark.parametrize("text", [
    "City council approves transport budget today. " + "! " * 40,
    "सरकार ने आज एक नई योजना की घोषणा की है। " * 10,
])
def test_research_abstention_does_not_load_a_model(text):
    def unexpected_load(_directory):
        raise AssertionError("Abstention must precede model loading")
    client = TestClient(create_app(ResearchService("/configured", loader=unexpected_load)))
    result = client.post("/api/research/analyze/text", json={"text": text})
    assert result.status_code == 200
    assert result.json()["research_score"] is None
    assert result.json()["confidence"] is None


def test_research_loading_is_lazy_cached_bounded_and_failure_is_safe():
    calls = []

    class StubChallenger:
        def __init__(self, directory):
            calls.append(directory)
            if len(calls) == 1:
                raise FileNotFoundError("/private/local/path")

        def predict(self, text):
            assert text == ARTICLE
            return {"research_score": .6, "warning": "Synthetic API-contract fixture only."}

    service = ResearchService("/configured", loader=StubChallenger)
    client = TestClient(create_app(service))
    assert calls == []
    response = client.post("/api/research/analyze/text", json={"text": ARTICLE})
    assert response.status_code == 503
    assert "/private/local/path" not in response.text
    # A failed load must release its slot, so a corrected configuration can retry.
    for _ in range(2):
        result = client.post("/api/research/analyze/text", json={"text": ARTICLE}).json()
        assert result["deployment_status"] == "research_only"
        assert result["confidence"] is None
        assert result["calibration_validated_for_production"] is False
        assert result["research_score"] == .6
    assert len(calls) == 2
    assert client.get("/api/research/health").json()["model_loaded"] is True
    with service.slot:
        response = client.post("/api/research/analyze/text", json={"text": ARTICLE})
        assert response.status_code == 503
        assert response.headers["Retry-After"] == "5"


def test_api_imports_do_not_import_optional_ml_libraries():
    result = subprocess.run([sys.executable, "-c", "import sys; import backend.main; import backend.research_api; assert 'torch' not in sys.modules; assert 'transformers' not in sys.modules"], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr


@pytest.mark.skipif(not os.getenv("VERITY_TEST_RESEARCH_MODEL_DIR"), reason="Opt-in actual local checkpoint inference; no downloads.")
def test_actual_local_research_checkpoint():
    service = ResearchService(Path(os.environ["VERITY_TEST_RESEARCH_MODEL_DIR"]))
    response = TestClient(create_app(service)).post("/api/research/analyze/text", json={"text": ARTICLE})
    assert response.status_code == 200, response.text
    result = response.json()
    assert 0 <= result["research_score"] <= 1
    assert result["model"] and result["revision"]
    assert result["max_tokens"] == service.model.metadata["config"]["max_length"]
    assert result["verdict"] == "uncertain"
    assert result["confidence"] is None
    assert result["calibration_validated_for_production"] is False
