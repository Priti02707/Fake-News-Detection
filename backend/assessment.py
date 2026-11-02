"""Bounded detection and source review; discovery never implies a truth verdict."""
import asyncio
from datetime import datetime, timezone

from fastapi import HTTPException
from starlette.concurrency import run_in_threadpool

from backend.evidence_providers import PROVIDERS
from backend.fusion import fuse
from backend.investigation import select_claims
from backend.schemas import ClaimInput, EvidenceInput


async def assess(payload, classify, retrieve):
    analysis, report, classification_error = None, None, None
    if payload.mode != "verify":
        try:
            analysis = await run_in_threadpool(classify, payload)
            report = fuse(analysis, payload.media, payload.reader_findings)
        except HTTPException as error:
            classification_error = str(error.detail)

    if payload.mode == "detect":
        return {"mode": payload.mode, "analysis": analysis, "report": report, "classification_error": classification_error, "verification": None}

    candidates = select_claims(payload.text)
    claim = payload.claim.strip() if payload.claim else candidates[0]["text"] if candidates else payload.text.strip()[:300]
    if len(claim) < 8:
        raise HTTPException(422, "Enter a specific claim of at least 8 characters.")
    query = ClaimInput(query=claim, language=payload.language)
    unavailable = {"status": "unavailable", "results": [], "message": "This source-search provider is unavailable. Add evidence or try again later."}

    async def search(name):
        try:
            return await asyncio.wait_for(PROVIDERS[name].search(query), timeout=14)
        except Exception:
            return dict(unavailable)

    async def passages(**source):
        try:
            return await asyncio.wait_for(retrieve(EvidenceInput(query=claim, **source)), timeout=7), None
        except HTTPException as error:
            return None, str(error.detail)
        except TimeoutError:
            return None, "Reading an evidence source timed out. Paste its text or try another source."
        except Exception:
            return None, "An evidence source could not be read. Paste its text or try another source."

    # At most two reader-provided sources, or two discovered sources. Search and
    # explicit retrieval overlap; discovered retrieval adds at most seven seconds.
    explicit = []
    if payload.source_url: explicit.append(passages(url=payload.source_url))
    if payload.source_text: explicit.append(passages(text=payload.source_text))
    results = await asyncio.gather(search("gdelt"), search("google_fact_check"), *explicit)
    news, fact_checks = results[:2]
    retrieved = list(results[2:])
    if not explicit:
        urls = list(dict.fromkeys(item["url"] for item in news.get("results", []) if isinstance(item, dict) and isinstance(item.get("url"), str)))[:2]
        retrieved = await asyncio.gather(*(passages(url=url) for url in urls))

    evidence = [item for item, _ in retrieved if item is not None]
    warnings = [warning for _, warning in retrieved if warning]
    has_passages = any(item.get("passages") for item in evidence)
    has_reviews = bool(fact_checks.get("results"))
    has_news = bool(news.get("results"))
    status = "review_required" if has_passages or has_reviews or has_news else "unavailable" if news["status"] == fact_checks["status"] == "unavailable" and not evidence else "no_matches"
    return {
        "mode": payload.mode, "analysis": analysis, "report": report, "classification_error": classification_error,
        "verification": {
            "status": status, "assessment": "INSUFFICIENT_EVIDENCE", "confidence": None,
            "claim": claim, "claim_selection": "reader_selected" if payload.claim else "heuristic_candidate",
            "checked_at": datetime.now(timezone.utc).isoformat(), "news": news, "fact_checks": fact_checks,
            "evidence": evidence, "warnings": warnings, "reader_notes": payload.notes,
            "explanation": "Relevant reporting, published ratings and exact passages are provided for review. No independently validated automated factual-verification model is deployed. A related result does not establish that this exact claim is supported or contradicted. Reader notes are context, not authenticated evidence.",
        },
    }
