from unittest.mock import patch

import numpy as np
import pandas as pd
import httpx
from fastapi.testclient import TestClient

from backend.main import app
from backend.investigation import retrieve_passages, select_claims
from scripts.evaluate import measure, temporal_split

client = TestClient(app)


def test_recent_coverage_discovery_filters_urls_and_preserves_index_dates():
    async def results(*args, **kwargs):
        return httpx.Response(200, json={"articles": [{"url": "https://example.com/news", "title": "A public report", "seendate": "20261101T120000Z"}, {"url": "javascript:alert(1)"}, {"url": "https://example.com/news"}]}, request=httpx.Request("GET", "https://api.gdeltproject.org"))
    with patch("httpx.AsyncClient.get", results):
        response = client.post("/api/coverage", json={"query": "public transport"})
    data = response.json()
    assert data["status"] == "matches"
    assert len(data["results"]) == 1
    assert data["results"][0]["indexed_at"] == "20261101T120000Z"
    assert "not verified" in data["message"]


def test_recent_coverage_distinguishes_outage_and_empty_results():
    async def empty(*args, **kwargs):
        return httpx.Response(200, json={"articles": []}, request=httpx.Request("GET", "https://api.gdeltproject.org"))
    async def outage(*args, **kwargs):
        raise httpx.ConnectError("offline")
    for handler, status in [(empty, "no_matches"), (outage, "unavailable")]:
        with patch("httpx.AsyncClient.get", handler):
            assert client.post("/api/coverage", json={"query": "public transport"}).json()["status"] == status


def test_claim_ranking_finds_later_statements_and_preserves_offsets():
    intro = "I think the local community should have a wonderful future. " * 3
    text = intro + "The City Council announced 25 new bus routes on Tuesday."
    candidates = select_claims(text)
    assert candidates[0]["text"].startswith("The City Council")
    assert all(text[item["start"]:item["end"]] == item["text"] for item in candidates)
    assert all(item["status"] == "unverified" and item["selection_method"] == "heuristic" for item in candidates)
    assert len(candidates) == 2  # repeated introductory statements are deduplicated


def test_passage_retrieval_never_invents_quotes_and_handles_no_matches():
    source = "The city council approved the transport budget on Tuesday. The botanical garden has many tropical plants."
    passages = retrieve_passages("city council transport budget", source)
    assert len(passages) == 1
    assert all(source[item["start"]:item["end"]] == item["text"] for item in passages)
    assert retrieve_passages("spaceships orbit distant planets", source) == []
    decimal = "The public transport budget increased by 3.5 percent in 2020."
    assert retrieve_passages("transport budget", decimal)[0]["text"] == decimal


def test_evidence_requires_exactly_one_source_and_blocks_private_urls():
    assert client.post("/api/evidence", json={"query": "city council transport budget"}).status_code == 422
    assert client.post("/api/evidence", json={"query": "city council transport budget", "url": "http://127.0.0.1", "text": "The city council approved the transport budget on Tuesday."}).status_code == 422
    assert client.post("/api/evidence", json={"query": "city council transport budget", "url": "http://127.0.0.1"}).status_code == 422


def test_pasted_evidence_has_no_fabricated_publisher_url_or_verdict():
    result = client.post("/api/evidence", json={"query": "city council transport budget", "text": "The city council approved the transport budget on Tuesday."}).json()
    assert result["source"]["url"] is None
    assert "not independently" in result["source"]["publisher"].lower()
    assert "verdict" not in result
    assert result["passages"] and result["retrieved_at"]


def test_extracted_evidence_retains_source_date_and_redirect_destination():
    source = {"title": "Transport report", "publisher": "example.com", "url": "https://example.com/final", "text": "The city council approved the transport budget on Tuesday.", "published_date": "2020-01-01", "truncated": False}
    with patch("backend.main.fetch_article", return_value=source):
        response = client.post("/api/evidence", json={"query": "city council transport budget", "url": "https://example.com/original"})
    result = response.json()
    assert response.status_code == 200
    assert result["source"]["url"] == source["url"]
    assert result["source"]["published_date"] == "2020-01-01"
    assert result["passages"][0]["text"] in source["text"]


def test_temporal_split_separates_days_and_repeated_headlines():
    dates = pd.date_range("2020-01-01", periods=120, tz="UTC")
    data = pd.DataFrame({"date": [str(value) for value in dates], "group": [str(index) for index in range(120)], "label": [index % 2 for index in range(120)]})
    data.loc[110, "group"] = data.loc[1, "group"]
    (train, calibration, test), _ = temporal_split(data)
    assert set(data.loc[train, "group"]).isdisjoint(data.loc[test, "group"])
    assert set(data.loc[calibration, "group"]).isdisjoint(data.loc[test, "group"])
    assert max(data.loc[train, "date"]) < min(data.loc[calibration, "date"])
    assert max(data.loc[calibration, "date"]) < min(data.loc[test, "date"])


def test_calibration_metrics_detect_confident_errors_and_count_all_examples():
    result = measure(np.array([0, 1, 0, 1]), np.array([.99, .99, .01, .01]))
    assert result["accuracy"] == .5
    assert result["ece"] > .4
    assert sum(item["count"] for item in result["reliability_bins"]) == 4


def test_evaluation_endpoint_has_measured_temporal_results_and_explicit_gaps():
    response = client.get("/api/evaluation")
    assert response.status_code == 200
    report = response.json()
    assert report["availability"]["temporal"] == "measured"
    assert "Not measured" in report["availability"]["publisher_holdout"]
    for experiment in report["experiments"]:
        for model in experiment["models"]:
            assert model["full_text"]["n"] == experiment["splits"]["test"]
