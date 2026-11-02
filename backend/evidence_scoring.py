"""Versioned conservative relevance aids; these scores are not truth probabilities."""
import hashlib
import re
from backend.investigation import tokens
from backend.source_credibility import publisher_score
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

VERSION = '2026-11-02.1'
MIN_RELEVANCE = 45


def canonical_url(url):
    try:
        parsed = urlsplit(url)
        query = urlencode(sorted((key, value) for key, value in parse_qsl(parsed.query, keep_blank_values=True) if not key.lower().startswith('utm_') and key.lower() not in {'fbclid', 'gclid'}))
        return urlunsplit((parsed.scheme.lower(), parsed.netloc.lower(), parsed.path or '/', query, ''))
    except (ValueError, TypeError):
        return str(url)


def relevance(claim, passage):
    terms, words = set(tokens(claim)), set(tokens(passage))
    coverage = len(terms & words) / max(1, len(terms))
    years = set(re.findall(r'\b(?:19|20)\d{2}\b', claim))
    source_years = set(re.findall(r'\b(?:19|20)\d{2}\b', passage))
    names = {value.lower() for value in re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b', claim)}
    name_match = sum(name in passage.lower() for name in names) / max(1, len(names)) if names else coverage
    score = round(100 * (.8 * coverage + .2 * name_match))
    mismatch = bool(years and source_years and not years.intersection(source_years))
    if mismatch:
        score = min(score, 20)
    return {'score': score, 'timeframe_mismatch': mismatch, 'method': 'token/entity/year heuristic; semantic and event match reviewed by grounded assessor', 'version': VERSION}


def prepare_evidence(claim, documents):
    candidates, seen = [], set()
    for doc in documents:
        source = doc['source']
        # Pasted material remains visible but cannot authenticate a factual conclusion.
        url = source.get('url')
        doc['credibility'] = publisher_score(url, authenticated=bool(url))
        family_text = ' '.join(' '.join(p['text'].split()) for p in doc.get('passages', []))
        doc['evidence_family'] = doc.get('content_fingerprint') or hashlib.sha256(family_text.encode()).hexdigest()[:16]
        for passage in doc.get('passages', []):
            scored = relevance(claim, passage['text'])
            passage['relevance'] = scored
            fingerprint = ' '.join(re.findall(r'\w+', passage['text'].lower()))
            if fingerprint in seen:
                continue
            seen.add(fingerprint)
            if not url or scored['score'] < MIN_RELEVANCE or scored['timeframe_mismatch']:
                continue
            identifier = hashlib.sha256(f"{url}:{passage['id']}".encode()).hexdigest()[:20]
            passage['citation_id'] = identifier
            candidates.append({'id': identifier, 'text': passage['text'], 'source_url': url,
                               'publisher': source.get('publisher'), 'published_date': source.get('published_date'),
                               'relevance': scored, 'evidence_family': doc['evidence_family']})
    return sorted(candidates, key=lambda p: -p['relevance']['score'])[:12]


def aggregate(findings):
    labels = {finding['assessment'] for finding in findings}
    if 'MIXED' in labels or {'SUPPORTED', 'REFUTED'} <= labels:
        return 'MIXED'
    if labels == {'SUPPORTED'}:
        return 'SUPPORTED'
    if labels == {'REFUTED'}:
        return 'REFUTED'
    return 'INSUFFICIENT_EVIDENCE'
