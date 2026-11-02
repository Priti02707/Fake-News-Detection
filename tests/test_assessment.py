from unittest.mock import patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)
TEXT = "The city council announced a new public transport proposal on Tuesday. Under the draft plan, two additional bus routes would connect residential neighborhoods with the railway station. Officials said the proposal would be open for public comment for thirty days before a final vote. Residents can submit feedback at a public meeting next month."
CLAIM = "The city council announced a new public transport proposal on Tuesday."


async def unavailable(*args):
    return {"status": "unavailable", "message": "Provider unavailable", "results": []}


def test_combined_mode_preserves_model_result_when_providers_are_unavailable():
    expected = client.post("/api/v2/analyze/text", json={"text": TEXT}).json()["analysis"]
    with patch("backend.evidence_providers.GDELTProvider.search", unavailable), patch("backend.evidence_providers.GoogleFactCheckProvider.search", unavailable):
        response = client.post("/api/v2/assess", json={"text": TEXT, "mode": "detect_verify"})
    assert response.status_code == 200
    data = response.json()
    for field in ("verdict", "confidence", "real_probability"):
        assert data["analysis"][field] == expected[field]
    assert data["verification"]["status"] == "unavailable"
    assert data["verification"]["assessment"] == "INSUFFICIENT_EVIDENCE"
    assert data["verification"]["confidence"] is None


def test_verification_only_never_runs_classifier_and_retains_exact_pasted_evidence():
    with patch("backend.main.classifier", side_effect=AssertionError("Classifier must not run")), patch("backend.evidence_providers.GDELTProvider.search", unavailable), patch("backend.evidence_providers.GoogleFactCheckProvider.search", unavailable):
        response = client.post("/api/v2/assess", json={"text": CLAIM, "mode": "verify", "claim": CLAIM, "source_text": TEXT, "notes": "Check the date separately."})
    assert response.status_code == 200
    data = response.json()
    assert data["analysis"] is None and data["report"] is None
    verification = data["verification"]
    assert verification["status"] == "review_required"
    assert verification["claim_selection"] == "reader_selected"
    assert verification["reader_notes"] == "Check the date separately."
    assert verification["evidence"][0]["source"]["url"] is None
    assert verification["evidence"][0]["date_context"]["status"] == "missing"
    assert verification["assessment"] == "INSUFFICIENT_EVIDENCE"
    for passage in verification["evidence"][0]["passages"]:
        assert TEXT[passage["start"]:passage["end"]] == passage["text"]


def test_only_two_discovered_sources_are_read_and_publisher_rating_is_preserved():
    calls = []
    async def news(*args):
        return {"status": "matches", "message": "News leads", "results": [{"url": f"https://example.com/{index}", "title": f"Source {index}"} for index in range(5)]}
    async def reviews(*args):
        return {"status": "matches", "message": "Published reviews", "results": [{"url": "https://example.org/review", "rating": "Misleading"}]}
    async def retrieve(payload):
        calls.append(payload.url)
        return {"source": {"url": payload.url}, "passages": [], "retrieved_at": "2026-11-02T10:00:00Z"}
    with patch("backend.evidence_providers.GDELTProvider.search", news), patch("backend.evidence_providers.GoogleFactCheckProvider.search", reviews):
        # Router captures retrieve at construction; test the service with this
        # explicitly injected retrieval function instead of mutating the router.
        import asyncio
        from backend.assessment import assess
        from backend.schemas import AssessmentInput
        data = asyncio.run(assess(AssessmentInput(text=TEXT, mode="verify"), None, retrieve))
    assert calls == ["https://example.com/0", "https://example.com/1"]
    assert data["verification"]["fact_checks"]["results"][0]["rating"] == "Misleading"
    assert data["verification"]["assessment"] == "INSUFFICIENT_EVIDENCE"


def test_private_evidence_url_is_rejected_without_losing_classification():
    with patch("backend.evidence_providers.GDELTProvider.search", unavailable), patch("backend.evidence_providers.GoogleFactCheckProvider.search", unavailable):
        data = client.post("/api/v2/assess", json={"text": TEXT, "source_url": "http://127.0.0.1"}).json()
    assert data["analysis"] is not None
    assert data["verification"]["evidence"] == []
    assert "Private, local, and reserved" in data["verification"]["warnings"][0]


def test_detection_only_never_searches_and_missing_model_does_not_block_review():
    with patch("backend.evidence_providers.GDELTProvider.search", side_effect=AssertionError("No search")):
        data = client.post("/api/v2/assess", json={"text": TEXT, "mode": "detect"}).json()
    assert data["analysis"] and data["verification"] is None
    with patch("backend.main.classifier", side_effect=HTTPException(503, "Model unavailable")), patch("backend.evidence_providers.GDELTProvider.search", unavailable), patch("backend.evidence_providers.GoogleFactCheckProvider.search", unavailable):
        data = client.post("/api/v2/assess", json={"text": TEXT, "source_text": TEXT}).json()
    assert data["analysis"] is None and data["classification_error"] == "Model unavailable"
    assert data["verification"]["evidence"][0]["passages"]


def test_empty_or_invalid_assessments_are_rejected():
    for payload in [{"text": " " * 12}, {"text": TEXT, "mode": "invented"}, {"text": TEXT, "source_text": "too short"}]:
        assert client.post("/api/v2/assess", json=payload).status_code == 422
