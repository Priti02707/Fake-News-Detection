"""Exact-domain publisher policy with server-fetched provenance checks."""
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

POLICY = json.loads((Path(__file__).resolve().parents[1] / 'configs/source-credibility.json').read_text())


def publisher_score(url, authenticated=False):
    result = {'status': 'unassessed', 'score': None, 'publisher': None, 'domain': None,
              'policy_version': POLICY['version'], 'rationale': POLICY['policy']}
    if not url or not authenticated:
        return result
    try:
        parsed = urlsplit(url)
        if parsed.scheme != 'https' or parsed.username or parsed.password or parsed.port not in {None, 443}:
            return result
        host = (parsed.hostname or '').encode('idna').decode().lower()
    except (ValueError, UnicodeError):
        return result
    result['domain'] = host
    for publisher in POLICY['publishers']:
        if host in publisher['domains'] + publisher['permitted_subdomains']:
            return {**result, **{key: publisher[key] for key in ['score', 'rationale', 'policy_url', 'reviewed_at']},
                    'status': 'recognized', 'publisher': publisher['name']}
    return result


def original_provenance(source, submitted_text, requested_url):
    normalize = lambda value: re.sub(r'\s+', ' ', value).strip()
    body = source.get('text', '')
    expected = [body, (source.get('title', '') + '\n\n' + body)[:20000]]
    matches = any(normalize(submitted_text) == normalize(value) for value in expected)
    # No fuzzy matching: a small alteration may change the claim's meaning.
    final_url = source.get('url')
    return {'status': 'verified' if matches else 'text_mismatch', 'requested_url': requested_url,
            'final_url': final_url, 'published_date': source.get('published_date'),
            'extraction_status': 'fetched', 'text_matches': matches,
            'credibility': publisher_score(final_url, authenticated=matches)}
