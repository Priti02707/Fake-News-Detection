from pathlib import Path
from unittest.mock import patch

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.extraction import resolve_public
from backend.inference import Classifier

client = TestClient(app)
TEXT = "The city council announced a new public transport proposal on Tuesday. Officials said that the proposal would be open for public comment for thirty days before a final vote. The transport department has not yet published the complete budget. Residents can submit feedback through the council website or attend a public meeting next month. The timeline and funding remain subject to approval."


def test_both_models_return_finite_probabilities_and_explanations():
    for model in ("logistic", "svm"):
        response = client.post("/api/analyze", json={"text": TEXT, "model": model})
        assert response.status_code == 200
        data = response.json()
        assert data["verdict"] in {"real", "fake", "uncertain"}
        assert .5 <= data["confidence"] <= 1
        assert 0 <= data["real_probability"] <= 1
        assert data["explanations"]
        assert all(claim["status"] == "unverified" for claim in data["claims"])


def test_short_claim_abstains_instead_of_claiming_truth():
    response = client.post("/api/analyze", json={"text": "The city council announced a new public transport proposal on Tuesday."})
    assert response.status_code == 200
    assert response.json()["verdict"] == "uncertain"
    assert any("Short text" in reason for reason in response.json()["reasons"])


def test_hindi_does_not_receive_english_probability_or_explanation():
    response = client.post("/api/analyze", json={"text": "नगर परिषद ने मंगलवार को एक नई सार्वजनिक परिवहन योजना की घोषणा की। यह एक उदाहरण समाचार है जिसकी स्वतंत्र जांच अभी बाकी है।"})
    assert response.status_code == 200
    data = response.json()
    assert data["verdict"] == "uncertain"
    assert data["confidence"] is None
    assert data["explanations"] == []


def test_validation_and_body_limits():
    assert client.post("/api/analyze", json={"text": "short"}).status_code == 422
    assert client.post("/api/analyze", json={"text": TEXT, "model": "invented"}).status_code == 422
    assert client.post("/api/analyze", json={"text": "a" * 20001}).status_code == 422
    assert client.post("/api/analyze", content=b"a" * 100001).status_code == 413


@pytest.mark.parametrize("url", ["http://127.0.0.1", "http://169.254.169.254/latest/meta-data", "http://[::1]", "file:///etc/passwd", "http://user:secret@example.com", "http://example.com:8080", "http://0.0.0.0"])
def test_local_urls_and_non_web_targets_are_rejected(url):
    with pytest.raises(ValueError):
        resolve_public(url)


def test_dns_with_any_private_address_is_rejected():
    with patch("backend.extraction.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("93.184.216.34", 443)), (2, 1, 6, "", ("10.0.0.1", 443))]):
        with pytest.raises(ValueError):
            resolve_public("https://example.com")


def test_fact_check_missing_key_is_unavailable_not_no_matches(monkeypatch):
    monkeypatch.delenv("GOOGLE_FACT_CHECK_API_KEY", raising=False)
    response = client.post("/api/fact-check", json={"query": "a specific statement to investigate"})
    assert response.status_code == 200
    assert response.json()["status"] == "unavailable"
    assert response.json()["results"] == []


def test_fact_check_no_matches_and_publisher_attribution(monkeypatch):
    monkeypatch.setenv("GOOGLE_FACT_CHECK_API_KEY", "test-not-a-real-key")
    async def no_results(*args, **kwargs):
        return httpx.Response(200, json={}, request=httpx.Request("GET", "https://factchecktools.googleapis.com"))
    with patch("httpx.AsyncClient.get", no_results):
        response = client.post("/api/fact-check", json={"query": "a specific statement to investigate"})
    assert response.json()["status"] == "no_matches"
    assert response.json()["message"] == "No matching fact-check found."
    async def match(*args, **kwargs):
        return httpx.Response(200, json={"claims": [{"text": "Example claim", "claimReview": [{"publisher": {"name": "Example publisher"}, "textualRating": "Partly false", "url": "https://example.com/review", "title": "Example review"}, {"url": "javascript:alert(1)"}]}]}, request=httpx.Request("GET", "https://factchecktools.googleapis.com"))
    with patch("httpx.AsyncClient.get", match):
        data = client.post("/api/fact-check", json={"query": "a specific statement to investigate"}).json()
    assert len(data["results"]) == 1
    assert data["results"][0]["rating"] == "Partly false"
    assert data["results"][0]["publisher"] == "Example publisher"


def test_metrics_are_measured_and_split_is_disjoint_size():
    data = client.get("/api/metrics").json()
    assert sum(data["splits"].values()) == data["usable_rows"]
    assert {model["id"] for model in data["models"]} == {"logistic", "svm"}
    for model in data["models"]:
        assert sum(sum(row) for row in model["confusion_matrix"]) == data["splits"]["test"]


def test_empty_vocabulary_stays_finite():
    runtime = Classifier(Path("models/classifier.json"))
    result = runtime.predict("zxqvvv zxqvvv")
    assert 0 <= result["real_probability"] <= 1
    assert result["explanations"] == []
