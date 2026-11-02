from unittest.mock import patch

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_worldwide_search_omits_language_restrictions_and_keeps_publisher_rating(monkeypatch):
    monkeypatch.setenv("GOOGLE_FACT_CHECK_API_KEY", "test-key")
    requests = {}

    async def get(_client, url, **kwargs):
        requests[url] = kwargs["params"]
        data = {"articles": [{"url": "https://example.com/news", "title": "World news", "sourcecountry": "Brazil", "language": "Portuguese"}]} if "gdeltproject" in url else {"claims": [{"text": "A related claim", "claimReview": [{"url": "https://example.org/review", "publisher": {"name": "Reviewer"}, "textualRating": "Misleading"}]}]}
        return httpx.Response(200, json=data, request=httpx.Request("GET", url))

    with patch("httpx.AsyncClient.get", get):
        response = client.post("/api/world-news", json={"query": "  international claim  "})
    assert response.status_code == 200
    report = response.json()
    assert report["query"] == "international claim"
    assert report["assessment"] == "INSUFFICIENT_EVIDENCE"
    assert report["fact_checks"]["results"][0]["rating"] == "Misleading"
    assert report["news"]["results"][0]["country"] == "Brazil"
    for url, params in requests.items():
        assert "languageCode" not in params
        if "gdeltproject" in url:
            assert "sourcecountry:" not in params["query"]
            assert "sourcelang:" not in params["query"]


def test_filters_apply_to_the_correct_provider(monkeypatch):
    monkeypatch.setenv("GOOGLE_FACT_CHECK_API_KEY", "test-key")
    async def get(_client, url, **kwargs):
        params = kwargs["params"]
        if "gdeltproject" in url:
            assert params["query"] == "public transport sourcelang:spanish sourcecountry:brazil"
            assert params["timespan"] == "7d"
            data = {"articles": []}
        else:
            assert params["languageCode"] == "es"
            assert "country" not in params and "timespan" not in params
            data = {"claims": []}
        return httpx.Response(200, json=data, request=httpx.Request("GET", url))
    with patch("httpx.AsyncClient.get", get):
        report = client.post("/api/world-news", json={"query": "public transport", "language": "es", "country": "brazil", "timespan": "7d"}).json()
    assert report["news"]["status"] == report["fact_checks"]["status"] == "no_matches"


def test_missing_key_preserves_news_and_manual_search(monkeypatch):
    monkeypatch.delenv("GOOGLE_FACT_CHECK_API_KEY", raising=False)
    async def get(_client, url, **kwargs):
        assert "gdeltproject" in url
        return httpx.Response(200, json={"articles": [{"url": "https://example.com/news"}]}, request=httpx.Request("GET", url))
    with patch("httpx.AsyncClient.get", get):
        report = client.post("/api/world-news", json={"query": "public transport"}).json()
    assert report["news"]["status"] == "matches"
    assert report["fact_checks"]["status"] == "unavailable"
    assert report["fact_checks"]["search_url"].endswith("public%20transport")


def test_provider_outage_does_not_discard_other_results(monkeypatch):
    monkeypatch.setenv("GOOGLE_FACT_CHECK_API_KEY", "test-key")
    async def get(_client, url, **kwargs):
        if "gdeltproject" in url:
            return httpx.Response(503, request=httpx.Request("GET", url))
        return httpx.Response(200, json={"claims": []}, request=httpx.Request("GET", url))
    with patch("httpx.AsyncClient.get", get):
        report = client.post("/api/world-news", json={"query": "public transport"}).json()
    assert report["news"]["status"] == "unavailable"
    assert report["fact_checks"]["status"] == "no_matches"


@pytest.mark.parametrize("values", [{"query": "         "}, {"language": "invalid"}, {"country": "invalid"}, {"timespan": "10years"}, {"query": "x" * 301}])
def test_invalid_world_search_is_rejected(values):
    assert client.post("/api/world-news", json={"query": "public transport", **values}).status_code == 422


def test_fact_check_links_reject_credentials_and_invalid_hosts(monkeypatch):
    monkeypatch.setenv("GOOGLE_FACT_CHECK_API_KEY", "test-key")
    async def get(_client, url, **kwargs):
        reviews = [{"url": value} for value in ["https://", "https://user:pass@example.com", "javascript:alert(1)", "https://example.com/review"]]
        return httpx.Response(200, json={"claims": [{"claimReview": reviews}]}, request=httpx.Request("GET", url))
    with patch("httpx.AsyncClient.get", get):
        report = client.post("/api/fact-check", json={"query": "public transport", "language": "all"}).json()
    assert [item["url"] for item in report["results"]] == ["https://example.com/review"]
