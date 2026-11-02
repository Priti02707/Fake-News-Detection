"""Bounded evidence-led assessment, separate from article writing-pattern inference."""
import asyncio
import copy
from datetime import datetime, timezone
from fastapi import HTTPException
from starlette.concurrency import run_in_threadpool

from backend.evidence_providers import PROVIDERS
from backend.evidence_assessor import assess_claim, unavailable
from backend.evidence_scoring import aggregate, relevance, canonical_url, VERSION
from backend.extraction import fetch_article
from backend.fusion import fuse
from backend.investigation import select_claims
from backend.schemas import ClaimInput, EvidenceInput
from backend.source_credibility import original_provenance, publisher_score

BUDGET_SECONDS = 24


async def assess(payload, classify, retrieve):
    analysis, report, classification_error = None, None, None
    if payload.mode != 'verify':
        try:
            analysis = await run_in_threadpool(classify, payload)
            report = fuse(analysis, payload.media, payload.reader_findings)
        except HTTPException as error:
            classification_error = str(error.detail)
    if payload.mode == 'detect':
        return {'mode': payload.mode, 'analysis': analysis, 'report': report,
                'classification_error': classification_error, 'verification': None}

    candidates = select_claims(payload.text, limit=3)
    claims = [payload.claim.strip()] if payload.claim else [c['text'] for c in candidates] or [payload.text.strip()[:300]]
    warnings, documents, findings, searches = [], [], [], []
    origin = None
    loop = asyncio.get_running_loop()
    deadline = loop.time() + BUDGET_SECONDS

    def remaining(cap):
        return max(.01, min(cap, deadline - loop.time()))

    search_slots = asyncio.Semaphore(4)

    async def search(name, claim):
        try:
            async with search_slots:
                return await asyncio.wait_for(PROVIDERS[name].search(ClaimInput(query=claim, language=payload.language)), remaining(9))
        except Exception:
            return {'status': 'unavailable', 'results': [], 'message': 'This source-search provider is unavailable.'}

    async def passages(source):
        try:
            # Retrieve against all selected claims; re-rank per claim below.
            return await asyncio.wait_for(retrieve(EvidenceInput(query=claims[0], queries=claims, **source)), remaining(6))
        except HTTPException as error:
            warnings.append(str(error.detail))
        except Exception:
            warnings.append('An evidence source could not be read within the shared deadline.')
        return None

    async def original():
        nonlocal origin
        if not payload.article_url:
            return
        try:
            source = await asyncio.wait_for(run_in_threadpool(fetch_article, payload.article_url), remaining(6))
            origin = original_provenance(source, payload.text, payload.article_url)
        except Exception:
            origin = {'status': 'unavailable', 'requested_url': payload.article_url, 'extraction_status': 'unavailable',
                      'credibility': publisher_score(None)}
            warnings.append('The original article could not be authenticated. No publisher score was inherited.')

    try:
        async with asyncio.timeout(BUDGET_SECONDS):
            # One original fetch plus at most three evidence URL fetches, or four
            # evidence fetches when no article URL exists. Pasted text is not fetched.
            results = await asyncio.gather(*(search(name, claim) for claim in claims for name in ('gdelt', 'google_fact_check')), original())
            searches = results[:-1]
            # Rank discovery leads for the same selected claims, interleave
            # fact-checks and news, and never turn a search snippet into proof.
            def ranked(offset):
                leads = {item['url']: item for result in searches[offset::2] for item in result.get('results', []) if isinstance(item, dict) and isinstance(item.get('url'), str)}
                return sorted(leads, key=lambda url: -max(relevance(claim, str(leads[url].get('claim', '')) + ' ' + str(leads[url].get('title', '')))['score'] for claim in claims))
            news_urls, review_urls = ranked(0), ranked(1)
            interleaved = [url for i in range(max(len(news_urls), len(review_urls))) for group in (review_urls, news_urls) for url in group[i:i+1]]
            urls = list({canonical_url(url): url for url in reversed([*payload.evidence_urls, *([payload.source_url] if payload.source_url else []), *interleaved])}.values())[::-1]
            # Original-source reporting is provenance, not independent corroboration.
            original_urls = {canonical_url(url) for url in [payload.article_url, (origin or {}).get('final_url')] if url}
            urls = [url for url in urls if canonical_url(url) not in original_urls][:3 if payload.article_url else 4]
            sources = [{'url': url} for url in urls]
            if payload.source_text:
                sources.append({'text': payload.source_text})
            docs = await asyncio.gather(*(passages(source) for source in sources))
            documents = [doc for doc in docs if doc is not None and (not doc['source'].get('url') or canonical_url(doc['source']['url']) not in original_urls)]
            # Re-rank fetched text across claims, preserving verbatim offsets.
            # Retrieval returns a bounded passage pool; no additional fetch is made.
            async def evaluate(claim):
                docs = copy.deepcopy(documents)
                finding = await asyncio.wait_for(assess_claim(claim, docs, timeout=remaining(8)), remaining(8))
                return finding, docs
            evaluated = await asyncio.gather(*(evaluate(claim) for claim in claims), return_exceptions=True)
            for claim, result in zip(claims, evaluated):
                findings.append(result[0] if isinstance(result, tuple) else unavailable(claim, 'The grounded assessor did not finish within the deadline.'))
            # Retain per-passage scoring for the primary claim in the source view.
            if evaluated and isinstance(evaluated[0], tuple):
                documents = evaluated[0][1]
    except TimeoutError:
        warnings.append('The shared assessment deadline was reached. Partial results are shown.')
    if not findings:
        findings = [unavailable(claim, 'Assessment did not complete. Retry or inspect sources manually.') for claim in claims]

    def merged(offset):
        items = searches[offset::2]
        leads = list({item.get('url'): item for result in items for item in result.get('results', []) if isinstance(item, dict)}.values())
        return {'status': 'matches' if leads else 'no_matches' if any(result.get('status') != 'unavailable' for result in items) else 'unavailable',
                'results': leads, 'message': 'Discovery leads only. Inspect the original claim, date and publisher rating.',
                **({'search_url': items[0]['search_url']} if items and items[0].get('search_url') else {})}
    news, fact_checks = merged(0), merged(1)
    assessed = any(f['assessor_status'] == 'assessed' for f in findings)
    usable = sum(bool(f.get('relevant_passages', f['citations'])) for f in findings)
    relevance_scores = [f['relevance_score'] for f in findings if f['relevance_score'] is not None]
    assessment = aggregate(findings)
    scores = {'version': VERSION, 'source_credibility': (origin or {}).get('credibility', publisher_score(None)),
              'evidence_relevance': round(sum(relevance_scores) / len(relevance_scores)) if relevance_scores else None,
              'evidence_coverage': round(100 * usable / len(claims)), 'assessed_claims': len(claims),
              'scope': 'Selected claims only; relevance/coverage and publisher policy are not truth probabilities.'}
    verification = {
        'status': 'assessed' if assessed else 'review_required' if documents or news['results'] or fact_checks['results'] else 'unavailable' if news['status'] == fact_checks['status'] == 'unavailable' else 'no_matches',
        'assessment': assessment, 'confidence': None, 'claim': claims[0],
        'claim_selection': 'reader_selected' if payload.claim else 'heuristic_candidate',
        'checked_at': datetime.now(timezone.utc).isoformat(), 'news': news, 'fact_checks': fact_checks,
        'evidence': documents, 'warnings': warnings, 'reader_notes': payload.notes,
        'claims': findings, 'scores': scores, 'original_source': origin,
        'assessor_status': 'assessed' if assessed else 'unavailable', 'schema_version': 2, 'provisional': True,
        'explanation': 'Provisional assessment of up to three selected claims, based only on authenticated retrieved passages. Exact citations require reader review. Unchecked claims and missing evidence cannot establish an article-wide verdict.',
    }
    return {'mode': payload.mode, 'analysis': analysis, 'report': report,
            'classification_error': classification_error, 'verification': verification}
