"""Opt-in server connection probes. Prints statuses only, never keys or responses."""
import asyncio
import json
import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import httpx
from backend import settings


async def probe(client, name, key_name, url, **kwargs):
    if key_name and not os.getenv(key_name):
        return name, 'not_configured'
    try:
        async with client.stream('GET', url, **kwargs) as response:
            code = response.status_code
            if 200 <= code < 300:
                body = bytearray()
                async for chunk in response.aiter_bytes():
                    body.extend(chunk)
                    if len(body) > 500_000:
                        return name, 'invalid_response'
                try:
                    data = json.loads(body)
                except ValueError:
                    return name, 'invalid_response'
                valid = isinstance(data, dict) and 'error' not in data and (name != 'groq' or data.get('id') == os.getenv('GROQ_MODEL', 'llama-3.3-70b-versatile')) and (name != 'gdelt' or isinstance(data.get('articles'), list))
                return name, 'connected' if valid else 'invalid_response'
        return name, 'authentication_failed' if code == 401 else 'access_denied' if code == 403 else 'rate_limited' if code == 429 else f'http_{code}'
    except (httpx.HTTPError, ValueError):
        return name, 'network_unavailable'


async def check():
    async with httpx.AsyncClient(timeout=10) as client:
        return dict(await asyncio.gather(
            probe(client, 'groq', 'GROQ_API_KEY', 'https://api.groq.com/openai/v1/models/' + os.getenv('GROQ_MODEL', 'llama-3.3-70b-versatile'), headers={'Authorization': 'Bearer ' + os.getenv('GROQ_API_KEY', '')}),
            probe(client, 'google_fact_check', 'GOOGLE_FACT_CHECK_API_KEY', 'https://factchecktools.googleapis.com/v1alpha1/claims:search', params={'key': os.getenv('GOOGLE_FACT_CHECK_API_KEY', ''), 'query': 'moon landing', 'pageSize': 1}),
            probe(client, 'gdelt', None, 'https://api.gdeltproject.org/api/v2/doc/doc', params={'query': 'moon landing', 'mode': 'artlist', 'format': 'json', 'maxrecords': 1}),
        ))


if __name__ == '__main__':
    print(json.dumps(asyncio.run(check()), indent=2))
