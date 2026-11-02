"""Synthetic fixtures test decision safeguards, not real-world model accuracy."""
import asyncio
import copy
import json
from unittest.mock import patch
import httpx
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.evidence_assessor import assess_claim, validate_decision
from backend.evidence_scoring import prepare_evidence, relevance, aggregate
from backend.source_credibility import publisher_score, original_provenance
from backend.schemas import AssessmentInput
from backend.assessment import assess
from backend.registry import selected_model
from backend.inference import Classifier
from pathlib import Path

CLAIM = 'The city council approved the transport budget on Tuesday.'
QUOTE = 'The city council approved the transport budget on Tuesday.'


def document(url='https://example.org/report', text=QUOTE):
    return {'source': {'url': url, 'title': 'Fixture report', 'publisher': 'Fixture source'},
            'passages': [{'id': 'p1', 'text': text, 'start': 0, 'end': len(text)}],
            'retrieved_at': '2026-11-02T10:00:00Z'}


def decision(passages, verdict='SUPPORTED'):
    return {'assessment': verdict, 'explanation': 'The exact statement is present in the supplied fixture.',
            'citations': [{'passage_id': passages[0]['id'], 'quote': QUOTE, 'stance': 'supports', 'semantic_match': True}]}


@pytest.mark.parametrize('url', ['https://reuters.com.evil.org/news', 'https://evilreuters.com/news', 'https://reuters.com@evil.org/news', 'http://reuters.com/news', 'https://reuters.com:444/news', 'https://other.reuters.com/news'])
def test_spoofs_and_unreviewed_subdomains_never_inherit_trust(url):
    assert publisher_score(url, True)['score'] is None


def test_publisher_policy_and_exact_text_provenance_are_separate_from_truth():
    source = {'url': 'https://www.reuters.com/report', 'title': 'Budget', 'text': QUOTE}
    original = original_provenance(source, 'Budget\n\n' + QUOTE, 'https://reuters.com/redirect')
    assert original['credibility']['score'] == 90
    altered = original_provenance(source, QUOTE.replace('approved', 'rejected'), source['url'])
    assert altered['status'] == 'text_mismatch' and altered['credibility']['score'] is None
    assert publisher_score(source['url'], False)['score'] is None
    assert publisher_score('https://unknown.org', True)['status'] == 'unassessed'


def test_irrelevant_year_and_person_reduce_relevance():
    claim = 'Alice Smith won the city election in 2024.'
    assert relevance(claim, 'Bob Jones won the city election in 2023.')['score'] <= 20
    assert relevance(claim, 'Alice Smith won the city election in 2024.')['score'] == 100


def test_pasted_text_is_not_authenticated_and_syndicated_quotes_are_deduplicated():
    assert not prepare_evidence(CLAIM, [document(None)])
    passages = prepare_evidence(CLAIM, [document(), document('https://second.org/report')])
    assert len(passages) == 1


def test_citation_validation_rejects_invented_ids_quotes_and_unmatched_semantics():
    passages = prepare_evidence(CLAIM, [document()])
    assert validate_decision(CLAIM, decision(passages), passages)['assessment'] == 'SUPPORTED'
    for key, value in [('passage_id', 'invented'), ('quote', 'An invented statement that is not in the passage.'), ('semantic_match', False)]:
        raw = decision(passages)
        raw['citations'][0][key] = value
        with pytest.raises(ValueError):
            validate_decision(CLAIM, raw, passages)
    with pytest.raises(ValueError):
        validate_decision(CLAIM, {**decision(passages), 'citations': []}, passages)
    with pytest.raises(ValueError):
        validate_decision(CLAIM, decision(passages, 'MIXED'), passages)


def test_conflicts_and_unchecked_claims_cannot_be_averaged_into_support():
    assert aggregate([{'assessment': 'SUPPORTED'}, {'assessment': 'REFUTED'}]) == 'MIXED'
    assert aggregate([{'assessment': 'SUPPORTED'}, {'assessment': 'INSUFFICIENT_EVIDENCE'}]) == 'INSUFFICIENT_EVIDENCE'


def test_groq_adapter_executes_and_rejects_invalid_provider_output(monkeypatch):
    monkeypatch.setenv('GROQ_API_KEY', 'synthetic-test-key')
    real_client = httpx.AsyncClient
    def respond(request):
        payload = json.loads(request.content)
        assert payload['response_format'] == {'type': 'json_object'}
        passages = json.loads(payload['messages'][1]['content'])['passages']
        return httpx.Response(200, json={'choices': [{'message': {'content': json.dumps(decision(passages))}}]})
    with patch('backend.evidence_assessor.httpx.AsyncClient', lambda **kwargs: real_client(transport=httpx.MockTransport(respond), trust_env=False)):
        result = asyncio.run(assess_claim(CLAIM, [document()]))
    assert result['assessment'] == 'SUPPORTED'
    assert result['citations'][0]['source_url'] == 'https://example.org/report'
    def invalid(request):
        return httpx.Response(200, json={'choices': [{'message': {'content': '{"assessment":"SUPPORTED","explanation":"Invented output", "citations":[]}'}}]})
    with patch('backend.evidence_assessor.httpx.AsyncClient', lambda **kwargs: real_client(transport=httpx.MockTransport(invalid), trust_env=False)):
        result = asyncio.run(assess_claim(CLAIM, [document()]))
    assert result['assessment'] == 'INSUFFICIENT_EVIDENCE' and result['assessor_status'] == 'unavailable'


def test_missing_key_abstains_without_discarding_sources(monkeypatch):
    monkeypatch.delenv('GROQ_API_KEY', raising=False)
    result = asyncio.run(assess_claim(CLAIM, [document()]))
    assert result['assessment'] == 'INSUFFICIENT_EVIDENCE'
    assert result['assessor_status'] == 'unavailable'
    assert result['relevance_score'] == 100
    assert result['relevant_passages'] == 1


def test_manifest_checksum_blocks_stale_or_tampered_selection(tmp_path):
    root = Path(__file__).resolve().parents[1]
    bundle = Classifier(root / 'models/classifier.json').bundle
    assert selected_model(bundle)[1]['status'] in {'baseline_pending_cv', 'cv_selected'}
    (tmp_path / 'models').mkdir()
    (tmp_path / 'models/selection.json').write_text(json.dumps({'selected_model': 'svm', 'artifact_sha256': 'bad'}))
    (tmp_path / 'models/classifier.json').write_text('{}')
    assert selected_model(bundle, tmp_path)[1]['status'] == 'baseline_fallback'


def test_auto_selection_is_default_and_short_inputs_bypass_models():
    client = TestClient(app)
    assert AssessmentInput(text=CLAIM).model == 'auto'
    result = client.post('/api/v2/analyze/text', json={'text': CLAIM}).json()['analysis']
    assert result['confidence'] is None
    assert result['model_selection']['status'] == 'not_run_short_input'


def test_three_claims_share_four_fetches_and_preserve_partial_results():
    calls = []
    async def search(*args):
        return {'status': 'matches', 'results': [{'url': f'https://example.org/{i}'} for i in range(8)]}
    async def retrieve(payload):
        calls.append(payload.url)
        return document(payload.url)
    async def grounded(claim, docs, **kwargs):
        passages = prepare_evidence(claim, docs)
        if not passages:
            return {'claim': claim, 'assessment': 'INSUFFICIENT_EVIDENCE', 'confidence': None, 'assessor_status': 'no_evidence', 'explanation': 'No matching fixture.', 'citations': [], 'relevance_score': None}
        return validate_decision(claim, decision(passages), passages)
    text = CLAIM + ' Officials announced the council transport budget on Tuesday. Residents said the council approved the transport budget on Tuesday.'
    with patch('backend.evidence_providers.GDELTProvider.search', search), patch('backend.evidence_providers.GoogleFactCheckProvider.search', search), patch('backend.assessment.assess_claim', grounded):
        data = asyncio.run(assess(AssessmentInput(text=text, mode='verify'), None, retrieve))['verification']
    assert len(calls) == 4 and len(set(calls)) == 4
    assert 1 <= len(data['claims']) <= 3
    assert data['confidence'] is None


def test_nested_selection_runs_on_synthetic_data_without_test_partition():
    import pandas as pd
    from scripts.model_selection import select_candidates
    data = pd.DataFrame({'content': [f'Fixture event {i} ' + ('council transport budget announced public meeting residents ' if i % 2 else 'invented rumor aliens miracle shocking claim secret ') * 3 for i in range(180)], 'label': [i % 2 for i in range(180)], 'group': [f'group-{i}' for i in range(180)]})
    result = select_candidates(data)
    assert result['status'] == 'cv_selected'
    assert result['training_rows'] == len(data)
    assert all(row['groups_disjoint'] for rows in result['cv_results'].values() for row in rows)


def test_secret_loader_never_executes_shell_or_overrides_deployment(tmp_path, monkeypatch):
    from backend.settings import load_local_env
    monkeypatch.setenv('GROQ_API_KEY', 'deployment-key')
    monkeypatch.delenv('GOOGLE_FACT_CHECK_API_KEY', raising=False)
    env = tmp_path / '.env'
    env.write_text('GROQ_API_KEY=local-key\nGOOGLE_FACT_CHECK_API_KEY="$(literal-no-shell)"\nNEXT_PUBLIC_SECRET=ignored\n')
    load_local_env(env)
    import os
    assert os.environ['GROQ_API_KEY'] == 'deployment-key'
    assert os.environ['GOOGLE_FACT_CHECK_API_KEY'] == '$(literal-no-shell)'
    assert 'NEXT_PUBLIC_SECRET' not in os.environ


def test_connection_probe_hides_keys_and_detects_invalid_payload(monkeypatch):
    from scripts.check_connections import probe
    monkeypatch.setenv('GROQ_API_KEY', 'synthetic-only')
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(200, text='not JSON')), trust_env=False) as client:
            return await probe(client, 'groq', 'GROQ_API_KEY', 'https://api.groq.com/openai/v1/models/test')
    assert asyncio.run(run()) == ('groq', 'invalid_response')


def test_original_url_provenance_integration_and_text_mismatch(monkeypatch):
    async def no_search(*args):
        return {'status': 'unavailable', 'results': []}
    source = {'url': 'https://www.reuters.com/report', 'text': CLAIM, 'title': 'Fixture article', 'publisher': 'www.reuters.com'}
    async def retrieve(payload):
        return document(payload.url)
    with patch('backend.assessment.fetch_article', lambda url: source), patch('backend.evidence_providers.GDELTProvider.search', no_search), patch('backend.evidence_providers.GoogleFactCheckProvider.search', no_search):
        data = asyncio.run(assess(AssessmentInput(text=CLAIM, article_url=source['url'], mode='verify'), None, retrieve))['verification']
        assert data['scores']['source_credibility']['score'] == 90
        assert data['assessment'] == 'INSUFFICIENT_EVIDENCE'
        changed = asyncio.run(assess(AssessmentInput(text=CLAIM.replace('approved', 'rejected'), article_url=source['url'], mode='verify'), None, retrieve))['verification']
        assert changed['scores']['source_credibility']['score'] is None


def test_duplicate_filter_preserves_negation_and_canonicalizes_tracking_urls():
    from backend.evidence_scoring import canonical_url
    negation = QUOTE.replace('approved', 'did not approve')
    passages = prepare_evidence(CLAIM, [document(), document('https://second.org/report', negation)])
    assert len(passages) == 2
    assert canonical_url('https://example.org/story?utm_source=test#top') == 'https://example.org/story'
