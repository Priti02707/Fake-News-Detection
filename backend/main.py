import asyncio
import hashlib
import json
import os
import re
import time
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from backend import settings
from backend.registry import selected_model

from backend.extraction import fetch_article, SourceBusyError
from backend.inference import Classifier
from backend.security import guard, correlation_id, logger
from backend.evidence_providers import PROVIDERS
from backend.language import identify_language
from backend.schemas import AnalyzeInput, URLInput, ClaimInput, EvidenceInput, WorldNewsInput
from backend.investigation import select_claims, retrieve_passages, publication_context

ROOT = Path(__file__).resolve().parents[1]
app = FastAPI(title="Fake News Detection API", version="2.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")


@app.middleware("http")
async def limit_body(request: Request, call_next):
    started = time.perf_counter()
    request_id = correlation_id(request.headers.get("X-Request-ID"))
    response = None
    if request.method == "POST":
        if not guard.allowed(request.client.host if request.client else "unknown"):
            response = JSONResponse(status_code=429, content={"detail": "Too many requests. Please try again in a minute."}, headers={"Retry-After": "60"})
        else:
            content = bytearray()
            maximum = 500_000 if request.url.path.startswith("/api/v2/") else 100_000
            async for chunk in request.stream():
                content.extend(chunk)
                if len(content) > maximum:
                    response = JSONResponse(status_code=413, content={"detail": "Request is too large."})
                    break
            request._body = bytes(content)
    if response is None:
        try:
            response = await call_next(request)
        except Exception as error:
            logger.error(json.dumps({
                "event": "request_error",
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "error_type": type(error).__name__,
            }))
            response = JSONResponse(status_code=500, content={"detail": "The service could not complete this request.", "request_id": request_id})
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Request-ID"] = request_id
    logger.info(json.dumps({"event": "request", "request_id": request_id, "method": request.method, "path": request.url.path, "status": response.status_code, "elapsed_ms": round((time.perf_counter() - started) * 1000, 2)}))
    return response


@lru_cache(maxsize=1)
def classifier():
    path = ROOT / "models/classifier.json"
    if not path.exists():
        raise HTTPException(503, "The trained model is unavailable. Run the training pipeline before serving predictions.")
    return Classifier(path)


@app.post("/api/claims")
def claims(payload: AnalyzeInput):
    return {"claims": select_claims(payload.text), "method": "Heuristic prioritization across the input, not a trained check-worthiness model."}


@app.post("/api/evidence")
async def evidence_passages(payload: EvidenceInput):
    if bool(payload.text) == bool(payload.url):
        raise HTTPException(422, "Provide either a public source URL or pasted source text.")
    if payload.url:
        try:
            source = await run_in_threadpool(fetch_article, payload.url)
        except SourceBusyError as error:
            raise HTTPException(503, str(error)) from error
        except ValueError as error:
            raise HTTPException(422, str(error)) from error
        except Exception as error:
            raise HTTPException(502, "The source could not be read. Paste its text instead.") from error
    else:
        source = {"text": payload.text, "title": "Reader-provided source", "url": None, "publisher": "Not independently authenticated", "truncated": False, "published_date": None}
    passages = list({item["id"]: item for query in (payload.queries or [payload.query]) for item in retrieve_passages(query, source["text"], limit=6)}.values())[:18]
    return {"query": payload.query, "content_fingerprint": hashlib.sha256(" ".join(source["text"].split()).encode()).hexdigest()[:16], "source": {key: value for key, value in source.items() if key != "text"}, "passages": passages, "date_context": publication_context(source.get("published_date")), "retrieval_method": "BM25 lexical relevance; repeated passages deduplicated within this source", "retrieved_at": datetime.now(timezone.utc).isoformat(), "note": "Verbatim source passages ranked by word overlap, not verified facts. Review dates, context, and source independence."}


@app.get("/api/evaluation")
def evaluation():
    path = ROOT / "models/robustness.json"
    if not path.exists():
        raise HTTPException(503, "Additional evaluation is not available.")
    return json.loads(path.read_text())


@app.post("/api/coverage")
async def coverage(payload: ClaimInput):
    return await PROVIDERS["gdelt"].search(payload)


@app.post("/api/world-news")
async def world_news(payload: WorldNewsInput):
    results = await asyncio.gather(
        PROVIDERS["gdelt"].search(payload),
        PROVIDERS["google_fact_check"].search(payload),
        return_exceptions=True,
    )
    def available(result):
        if isinstance(result, Exception):
            return {"status": "unavailable", "results": [], "message": "This search provider is temporarily unavailable. Try again later."}
        return result
    return {
        "query": payload.query,
        "filters": {"language": payload.language, "country": payload.country, "timespan": payload.timespan},
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "assessment": "INSUFFICIENT_EVIDENCE",
        "news": available(results[0]), "fact_checks": available(results[1]),
        "note": "Search results are leads for review, not an automated factual verdict. Country and time filters apply to news coverage only; fact-checks use the selected language across all countries and dates. Coverage depends on provider indexing and query language.",
    }


@app.get("/api/health")
def health():
    return {"status": "ok", "model_ready": (ROOT / "models/classifier.json").exists(), "fact_check_configured": bool(os.getenv("GOOGLE_FACT_CHECK_API_KEY")), "evidence_assessor_configured": bool(os.getenv("GROQ_API_KEY")), "automatic_model_selection": selected_model(classifier().bundle)[1] if (ROOT / "models/classifier.json").exists() else None}


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
    language = identify_language(text)
    supported = non_latin_ratio < .1 and language["code"] == "en"
    model_id, selection = selected_model(classifier().bundle)
    if payload.model != "auto":
        model_id = payload.model
        selection = {"status": "explicit_legacy_request", "reason": "Explicit research/legacy API choice."}
    selected = classifier().predict(text, model_id)
    other = classifier().predict(text, "svm" if model_id == "logistic" else "logistic")
    probability = selected["real_probability"]
    confidence = max(probability, 1 - probability)
    reasons = []
    if not supported:
        reasons.append("This model was evaluated on English articles only. The language detector or script check identified unsupported or uncertain language.")
    if len(words) < 40:
        reasons.append("Short text: this model was evaluated on full articles, so a headline alone is insufficient.")
    if selected["known_feature_ratio"] < .08:
        reasons.append("The text has limited vocabulary overlap with the training data.")
    if confidence < .8:
        reasons.append("The calibrated model score is below the 80% decision threshold.")
    if (probability >= .5) != (other["real_probability"] >= .5):
        reasons.append("The two classifiers disagree on this article.")
    verdict = "uncertain" if reasons else ("real" if probability >= .5 else "fake")
    return {"verdict": verdict, "language": language, "model": model_id, "model_selection": selection, "model_name": classifier().bundle["models"][model_id]["name"], "confidence": round(confidence, 5) if supported else None, "real_probability": round(probability, 5) if supported else None, "explanations": selected["explanations"] if supported else [], "reasons": reasons, "word_count": len(words), "elapsed_ms": round((time.perf_counter() - start) * 1000, 2), "claims": select_claims(payload.text), "note": "This is a learned writing-pattern classification, not a verification of factual truth. Candidate statements are selected heuristically across the article and remain unverified."}


@app.post("/api/extract")
async def extract(payload: URLInput):
    try:
        return await run_in_threadpool(fetch_article, payload.url)
    except SourceBusyError as error:
        raise HTTPException(503, str(error)) from error
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    except Exception as error:
        raise HTTPException(502, "The publisher could not be reached. Please paste the article text instead.") from error


@app.post("/api/fact-check")
async def fact_check(payload: ClaimInput):
    return await PROVIDERS["google_fact_check"].search(payload)


from backend.v2 import build_router
app.include_router(build_router(analyze, extract, evidence_passages, metrics, evaluation))
