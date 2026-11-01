import json
import os
import re
import time
from functools import lru_cache
from pathlib import Path
from typing import Literal
from urllib.parse import quote

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from backend.extraction import fetch_article
from backend.inference import Classifier

ROOT = Path(__file__).resolve().parents[1]
app = FastAPI(title="Verity News API", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")


@app.middleware("http")
async def limit_body(request: Request, call_next):
    if request.method == "POST":
        content = bytearray()
        async for chunk in request.stream():
            content.extend(chunk)
            if len(content) > 100_000:
                return JSONResponse(status_code=413, content={"detail": "Request is too large."})
        request._body = bytes(content)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    return response


@lru_cache(maxsize=1)
def classifier():
    path = ROOT / "models/classifier.json"
    if not path.exists():
        raise HTTPException(503, "The trained model is unavailable. Run the training pipeline before serving predictions.")
    return Classifier(path)


class AnalyzeInput(BaseModel):
    text: str = Field(min_length=40, max_length=20000)
    model: Literal["logistic", "svm"] = "logistic"


class URLInput(BaseModel):
    url: str = Field(min_length=8, max_length=2048)


class ClaimInput(BaseModel):
    query: str = Field(min_length=8, max_length=300)


@app.get("/api/health")
def health():
    return {"status": "ok", "model_ready": (ROOT / "models/classifier.json").exists(), "fact_check_configured": bool(os.getenv("GOOGLE_FACT_CHECK_API_KEY"))}


@app.get("/api/metrics")
def metrics():
    return classifier().bundle["metadata"]


@app.post("/api/analyze")
def analyze(payload: AnalyzeInput):
    start = time.perf_counter()
    text = payload.text.strip()
    words = re.findall(r"\b\w+\b", text)
    if len(words) < 8:
        raise HTTPException(422, "Please provide at least 8 words of article text.")
    letters = [char for char in text if char.isalpha()]
    non_latin_ratio = sum(ord(char) > 591 for char in letters) / max(1, len(letters))
    supported = non_latin_ratio < .1
    selected = classifier().predict(text, payload.model)
    other = classifier().predict(text, "svm" if payload.model == "logistic" else "logistic")
    probability = selected["real_probability"]
    confidence = max(probability, 1 - probability)
    reasons = []
    if not supported:
        reasons.append("This model was evaluated on English articles only. This text appears to include an unsupported script.")
    if len(words) < 40:
        reasons.append("Short text: this model was evaluated on full articles, so a headline alone is insufficient.")
    if selected["known_feature_ratio"] < .08:
        reasons.append("The text has limited vocabulary overlap with the training data.")
    if confidence < .8:
        reasons.append("The calibrated model score is below the 80% decision threshold.")
    if (probability >= .5) != (other["real_probability"] >= .5):
        reasons.append("The two classifiers disagree on this article.")
    verdict = "uncertain" if reasons else ("real" if probability >= .5 else "fake")
    sentences = re.split(r"(?<=[.!?।])\s+", text)
    claims = [sentence.strip()[:300] for sentence in sentences if len(sentence.split()) >= 8][:3]
    return {"verdict": verdict, "model": payload.model, "model_name": classifier().bundle["models"][payload.model]["name"], "confidence": round(confidence, 5) if supported else None, "real_probability": round(probability, 5) if supported else None, "explanations": selected["explanations"] if supported else [], "reasons": reasons, "word_count": len(words), "elapsed_ms": round((time.perf_counter() - start) * 1000, 2), "claims": [{"text": claim, "status": "unverified"} for claim in claims], "note": "This is a learned writing-pattern classification, not a verification of factual truth. Extracted sentences are search candidates, not verified claims."}


@app.post("/api/extract")
async def extract(payload: URLInput):
    try:
        return await run_in_threadpool(fetch_article, payload.url)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    except Exception as error:
        raise HTTPException(502, "The publisher could not be reached. Please paste the article text instead.") from error


@app.post("/api/fact-check")
async def fact_check(payload: ClaimInput):
    manual_url = "https://toolbox.google.com/factcheck/explorer/search/" + quote(payload.query, safe="")
    key = os.getenv("GOOGLE_FACT_CHECK_API_KEY")
    if not key:
        return {"status": "unavailable", "message": "Published fact-check search is not configured for this deployment. You can search manually using the link below.", "results": [], "search_url": manual_url}
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.get("https://factchecktools.googleapis.com/v1alpha1/claims:search", params={"key": key, "query": payload.query, "languageCode": "en", "pageSize": 5})
            response.raise_for_status()
            data = response.json()
    except (httpx.HTTPError, ValueError):
        return {"status": "unavailable", "message": "Fact-check search is temporarily unavailable. Try again later or search manually.", "results": [], "search_url": manual_url}
    results = []
    for claim in data.get("claims", []):
        for review in claim.get("claimReview", []):
            url = review.get("url", "")
            if not url.startswith(("https://", "http://")):
                continue
            results.append({"claim": claim.get("text", ""), "publisher": review.get("publisher", {}).get("name", "Fact-check publisher"), "title": review.get("title", "Read fact-check"), "url": url, "rating": review.get("textualRating", "No rating supplied"), "date": review.get("reviewDate", "")})
    return {"status": "matches" if results else "no_matches", "message": "Related published fact-checks. Check that each source addresses the same claim and date." if results else "No matching fact-check found.", "results": results[:8], "search_url": manual_url}
