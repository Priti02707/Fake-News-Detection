"""Permitted external source discovery. Provider results are never truth verdicts."""
import os
import asyncio
import threading
from functools import wraps
from typing import Protocol
from urllib.parse import quote, urlsplit
import httpx
from backend.schemas import ClaimInput

_slots = threading.BoundedSemaphore(4)


def bounded_search(function):
    @wraps(function)
    async def wrapped(self, payload):
        if not _slots.acquire(blocking=False):
            return {"status": "unavailable", "results": [], "message": "Source search is busy. Try again shortly or add a source directly.", "search_url": "https://toolbox.google.com/factcheck/explorer/search/" + quote(payload.query, safe="")}
        try: return await function(self, payload)
        finally: _slots.release()
    return wrapped

class EvidenceProvider(Protocol):
    async def search(self, payload: ClaimInput) -> dict: ...

async def provider_get(client, url, **kwargs):
    # One bounded retry for connection failures only; never retry 429/auth errors.
    try: return await client.get(url, **kwargs)
    except httpx.ConnectError:
        await asyncio.sleep(.2)
        return await client.get(url, **kwargs)

class GDELTProvider:
    @bounded_search
    async def search(self, payload: ClaimInput):
        """Discover recent news sources; this is not a fact-check verdict."""
        unavailable = {"status": "unavailable", "results": [], "message": "Recent news search is temporarily unavailable. Add a source URL or paste evidence text instead."}
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await provider_get(client, "https://api.gdeltproject.org/api/v2/doc/doc", params={"query": payload.query, "mode": "artlist", "format": "json", "maxrecords": 8, "timespan": "3months", "sort": "hybridrel"})
                response.raise_for_status()
                if len(response.content) > 500_000: return unavailable
                data = response.json()
            if not isinstance(data, dict) or not isinstance(data.get("articles", []), list): return unavailable
            results, seen = [], set()
            for item in data.get("articles", [])[:20]:
                if not isinstance(item, dict): continue
                url = item.get("url", "")
                if not isinstance(url, str): continue
                try: parsed = urlsplit(url)
                except ValueError: continue
                if parsed.scheme not in {"https", "http"} or not parsed.hostname or parsed.username or parsed.password or url in seen: continue
                seen.add(url)
                results.append({"url": url, "title": str(item.get("title", "Untitled source"))[:500], "publisher": parsed.hostname, "indexed_at": str(item.get("seendate", ""))[:30]})
            return {"status": "matches" if results else "no_matches", "results": results[:8], "message": "Recent news coverage from GDELT. These are leads, not verified fact-checks. Inspect each source and its date." if results else "No recent coverage matched these keywords. Try a shorter query; absence of results does not establish truth or falsehood."}
        except (httpx.HTTPError, ValueError, TypeError):
            return unavailable

class GoogleFactCheckProvider:
    @bounded_search
    async def search(self, payload: ClaimInput):
        manual_url = "https://toolbox.google.com/factcheck/explorer/search/" + quote(payload.query, safe="")
        key = os.getenv("GOOGLE_FACT_CHECK_API_KEY")
        if not key:
            return {"status": "unavailable", "message": "Published fact-check search is not configured for this deployment. You can search manually using the link below.", "results": [], "search_url": manual_url}
        try:
            async with httpx.AsyncClient(timeout=12) as client:
                response = await provider_get(client, "https://factchecktools.googleapis.com/v1alpha1/claims:search", params={"key": key, "query": payload.query, "languageCode": payload.language, "pageSize": 5})
                response.raise_for_status()
                data = response.json()
                if not isinstance(data, dict) or "error" in data or ("claims" in data and not isinstance(data["claims"], list)): raise ValueError("Invalid provider response")
        except (httpx.HTTPError, ValueError):
            return {"status": "unavailable", "message": "Fact-check search is temporarily unavailable. Try again later or search manually.", "results": [], "search_url": manual_url}
        results = []
        for claim in data.get("claims", []):
            if not isinstance(claim, dict) or not isinstance(claim.get("claimReview", []), list): continue
            for review in claim.get("claimReview", []):
                if not isinstance(review, dict): continue
                url = review.get("url", "")
                if not isinstance(url, str) or not url.startswith(("https://", "http://")):
                    continue
                results.append({"claim": claim.get("text", ""), "publisher": (review.get("publisher") if isinstance(review.get("publisher"), dict) else {}).get("name", "Fact-check publisher"), "title": review.get("title", "Read fact-check"), "url": url, "rating": review.get("textualRating", "No rating supplied"), "date": review.get("reviewDate", "")})
        return {"status": "matches" if results else "no_matches", "message": "Related published fact-checks. Check that each source addresses the same claim and date." if results else "No matching fact-check found.", "results": results[:8], "search_url": manual_url}

PROVIDERS: dict[str, EvidenceProvider] = {"gdelt": GDELTProvider(), "google_fact_check": GoogleFactCheckProvider()}
