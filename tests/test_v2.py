from fastapi.testclient import TestClient
from backend.main import app
from backend.fusion import fuse
from backend.registry import promotion_decision
from backend.security import RequestGuard, correlation_id
from scripts.data_pipeline import clean_text, prepare_articles
from pathlib import Path
import pytest
from fastapi import FastAPI
from backend.v2 import build_router

client = TestClient(app)
TEXT = "The city council announced a new public transport proposal on Tuesday. Officials said that the proposal would be open for public comment for thirty days before a final vote. Residents can submit feedback at a public meeting next month."


def test_v2_text_contract_preserves_legacy_prediction_and_no_truth_average():
    old = client.post("/api/analyze", json={"text": TEXT}).json()
    response = client.post("/api/v2/analyze/text", json={"text": TEXT})
    assert response.status_code == 200
    result = response.json()
    assert result["analysis"]["verdict"] == old["verdict"]
    assert result["report"]["claim_verification"]["assessment"] == "INSUFFICIENT_EVIDENCE"
    assert result["report"]["modalities"]["media_authenticity"] == "not_analyzed"
    assert "truth_probability" not in result["report"]
    assert response.headers["X-Request-ID"]


def test_v2_headline_is_accepted_but_never_given_a_full_article_score():
    response = client.post("/api/v2/analyze/text", json={"text": "City council approves transport budget"})
    assert response.status_code == 200
    assert response.json()["analysis"]["confidence"] is None
    assert response.json()["analysis"]["verdict"] == "uncertain"


@pytest.mark.parametrize("text", [
    "City council approves a new public transport budget today.",
    "City council approves a new public transport budget today. " + "! " * 40,
])
def test_v2_short_url_content_abstains_without_calling_classifier(text):
    source = {"text": text, "url": "https://example.com/news", "title": "Council budget"}

    async def extract(_payload):
        return source

    def unexpected_classification(_payload):
        raise AssertionError("Short extracted content must not reach the article classifier")

    application = FastAPI()
    application.include_router(build_router(unexpected_classification, extract, None, None, None))
    with TestClient(application) as isolated:
        response = isolated.post("/api/v2/analyze/url", json={"url": source["url"]})
        assert response.status_code == 200
        result = response.json()
        assert result["source"] == source
        assert result["analysis"]["verdict"] == "uncertain"
        assert result["analysis"]["confidence"] is None
        assert result["analysis"]["real_probability"] is None
        assert result["report"]["content_classification"] == result["analysis"]
        # The same word-count guard must apply when this content is pasted.
        response = isolated.post("/api/v2/analyze/text", json={"text": text})
        assert response.status_code == 200
        assert response.json()["analysis"]["confidence"] is None


def test_v2_full_url_article_preserves_classification_and_source(monkeypatch):
    import backend.main as main
    article = TEXT + " The council will publish further details after the meeting."
    source = {"text": article, "url": "https://example.com/news", "title": "Council proposal"}
    monkeypatch.setattr(main, "fetch_article", lambda _url: source)
    response = client.post("/api/v2/analyze/url", json={"url": source["url"]})
    assert response.status_code == 200
    result = response.json()
    pasted = client.post("/api/v2/analyze/text", json={"text": article}).json()
    assert result["source"] == source
    for field in ("verdict", "confidence", "real_probability", "model", "word_count"):
        assert result["analysis"][field] == pasted["analysis"][field]


def test_external_evaluation_rejects_claim_tasks_and_unreviewed_licenses():
    from scripts.evaluate_external import validate_manifest
    import pytest
    with pytest.raises(ValueError): validate_manifest({"task": "claim_verification"})
    with pytest.raises(ValueError): validate_manifest({"task": "article_classification", "source_url": "https://example.com", "license": "unknown"})


def test_provided_publisher_groups_remain_disjoint():
    import pandas as pd
    from scripts.evaluate import publisher_split
    data = pd.DataFrame({"publisher": [f"source-{index // 100}" for index in range(1000)], "group": [f"headline-{index}" for index in range(1000)], "label": [index % 2 for index in range(1000)]})
    train, calibration, test = publisher_split(data, "publisher")
    assert set(data.iloc[train].publisher).isdisjoint(data.iloc[test].publisher)
    assert set(data.iloc[calibration].publisher).isdisjoint(data.iloc[test].publisher)


def test_external_evaluator_executes_on_a_documented_synthetic_fixture(tmp_path, monkeypatch):
    import json
    import pandas as pd
    from scripts import evaluate_external
    # Tests schema/metric execution only; these invented labels are not a research benchmark.
    frame = pd.DataFrame({"title": [f"Synthetic fixture article {index}" for index in range(40)], "text": [f"This invented example describes council meeting number {index} and a proposed transport service for residents to discuss." for index in range(40)], "label": [index % 2 for index in range(40)]})
    csv = tmp_path / "fixture.csv"; frame.to_csv(csv, index=False)
    manifest = tmp_path / "manifest.json"; manifest.write_text(json.dumps({"task": "article_classification", "source_url": "https://example.com/synthetic-fixture", "license": "Synthetic unit-test text", "license_reviewed": True, "label_mapping": {"0": "fake", "1": "real"}}))
    monkeypatch.setattr(evaluate_external, "prepare_articles", lambda *args: (pd.DataFrame({"key": ["nonoverlapping original hash"]}), {}))
    result = evaluate_external.evaluate(csv, manifest, tmp_path / "output.json")
    assert result["examples"] == 40
    assert set(result["models"]) == {"logistic", "svm"}
    assert result["manifest"]["license"] == "Synthetic unit-test text"


def test_v2_reviewed_media_marks_client_origin_and_missing_visual_stages():
    payload = {"text": TEXT, "media": {"kind": "video", "filename": "example.webm", "segments": [{"text": TEXT, "start": 0, "end": 12}], "frames": [{"id": "frame-0", "timestamp": .05, "width": 640, "height": 360, "text": "A visible caption", "ocr_status": "text_found"}]}}
    result = client.post("/api/v2/analyze/video", json=payload)
    assert result.status_code == 200
    report = result.json()["report"]
    assert report["modalities"]["video_frames"] == "client_samples_inspected"
    assert "not independently authenticated" in " ".join(report["uncertainty"])
    assert client.post("/api/v2/analyze/image", json=payload).status_code == 422
    payload["media"]["frames"][0]["timestamp"] = 500
    assert client.post("/api/v2/analyze/video", json=payload).status_code == 422
    payload["media"]["frames"][0]["timestamp"] = 1
    payload["media"]["segments"][0]["start"] = 15
    assert client.post("/api/v2/analyze/video", json=payload).status_code == 422


def test_v2_verification_does_not_invent_outcomes_from_pasted_evidence():
    result = client.post("/api/v2/verify/claims", json={"claim": "The city council approved its transport budget.", "source_text": TEXT}).json()
    assert result["assessment"] == "INSUFFICIENT_EVIDENCE"
    assert result["confidence"] is None
    assert result["evidence"][0]["passages"]
    assert result["evidence"][0]["source"]["url"] is None


def test_french_latin_script_is_not_given_an_english_classifier_score():
    text = "Le conseil municipal a annoncé une nouvelle proposition de transport public mardi. Les habitants peuvent participer à une réunion publique pour discuter du financement et des prochaines étapes du projet."
    result = client.post("/api/analyze", json={"text": text}).json()
    assert result["verdict"] == "uncertain"
    assert result["confidence"] is None
    assert result["language"]["code"] == "fr"


def test_bounded_request_guard_expires_and_never_grows_without_bound():
    guard = RequestGuard(limit=2, window=60, capacity=2)
    assert guard.allowed("a", 0) and guard.allowed("a", 1)
    assert not guard.allowed("a", 2)
    assert guard.allowed("b", 2)
    assert not guard.allowed("c", 2)
    assert guard.allowed("c", 100)
    assert len(guard.requests) <= 2
    assert correlation_id("valid_request_id") == "valid_request_id"
    assert correlation_id("bad\nheader") != "bad\nheader"


def test_training_preprocessing_and_conflicting_label_removal(tmp_path):
    assert clean_text("<script>bad()</script><p>A &amp; B</p>") == "A & B"
    text = "This is a sufficiently long article about the public transport budget and a council meeting."
    for name in ["fake", "real"]:
        (tmp_path / f"{name}.csv").write_text(f'title,text\nSame headline,"{text}"\n')
    data, report = prepare_articles(tmp_path / "fake.csv", tmp_path / "real.csv")
    assert len(data) == 0
    assert report["conflicting_content_groups"] == 1


def test_small_challenger_cannot_pass_promotion_policy():
    result = promotion_decision({"test_examples": 32, "macro_f1": 1, "brier_score": 0, "p95_latency_ms": 10}, {"macro_f1": .9, "brier_score": .1})
    assert not result["eligible"]
    assert not result["automatic_promotion"]
    assert any("independent" in reason.lower() for reason in result["reasons"])


def test_reader_fusion_requires_citations_and_preserves_author_and_conflicts():
    missing = {"claim": "The city council approved its budget.", "assessment": "SUPPORTED", "citations": []}
    assert client.post("/api/v2/analyze/text", json={"text": TEXT, "reader_findings": [missing]}).status_code == 422
    supported = {**missing, "citations": [{"quote": "The city council approved its budget.", "source_url": None}]}
    refuted = {**supported, "assessment": "REFUTED"}
    report = client.post("/api/v2/analyze/text", json={"text": TEXT, "reader_findings": [supported, refuted]}).json()["report"]
    assert report["claim_verification"]["assessment"] == "MIXED"
    assert report["claim_verification"]["assessment_author"] == "reader"
    assert report["claim_verification"]["confidence"] is None
    assert report["conflicting_signals"]


def test_capabilities_do_not_advertise_raw_uploads_or_fake_server_jobs():
    result = client.get("/api/v2/capabilities").json()
    assert result["raw_media_uploads"] is False
    assert result["server_media_jobs"] is False
    assert result["deepfake_detection"] == "unavailable"
