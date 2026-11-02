"""Exercise the Python entry point without files excluded from deployment."""
import fnmatch
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]


def ignored(path, rules):
    excluded = False
    for rule in rules:
        rule = rule.strip()
        if not rule or rule.startswith('#'):
            continue
        negate = rule.startswith('!')
        pattern = rule.lstrip('!').rstrip('/')
        candidates = [path, *[str(parent) for parent in Path(path).parents]]
        if any(fnmatch.fnmatchcase(candidate, pattern) for candidate in candidates):
            excluded = not negate
    return excluded


def test_deployed_python_bundle_starts_without_excluded_files(tmp_path):
    config = json.loads((ROOT / 'vercel.json').read_text())
    pattern = config['functions']['api/index.py']['excludeFiles']
    # The function uses a brace-expanded list of glob exclusions.
    assert pattern.startswith('{') and pattern.endswith('}')
    function_rules = pattern[1:-1].split(',')
    upload_rules = (ROOT / '.vercelignore').read_text().splitlines()
    tracked = subprocess.check_output(
        ['git', 'ls-files', '-z'], cwd=ROOT, text=True,
    ).rstrip('\0').split('\0')
    assert 'configs/source-credibility.json' in tracked
    for name in tracked:
        if Path(name).parts[0] not in {'api', 'backend', 'configs', 'models'}:
            continue
        if ignored(name, upload_rules) or ignored(name, function_rules):
            continue
        destination = tmp_path / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, destination)

    assert not list(tmp_path.glob('configs/transformer*.json'))
    assert not (tmp_path / '.env').exists()
    env = os.environ.copy()
    for name in ('PYTHONPATH', 'GROQ_API_KEY', 'GOOGLE_FACT_CHECK_API_KEY'):
        env.pop(name, None)
    # A fresh interpreter and cwd prevent the already imported checkout from
    # hiding import-time failures in the actual api.index:app entry point.
    result = subprocess.run(
        [sys.executable, '-c', '''
from pathlib import Path
from fastapi.testclient import TestClient
from api.index import app
import backend.source_credibility as credibility

assert Path(credibility.__file__).resolve().is_relative_to(Path.cwd())
with TestClient(app) as client:
    health = client.get('/api/health')
    assert health.status_code == 200, health.text
    assert health.json()['status'] == 'ok'
    assert health.json()['model_ready'] is True
    capabilities = client.get('/api/v2/capabilities')
    assert capabilities.status_code == 200, capabilities.text
    assert capabilities.json()['raw_media_uploads'] is False
'''],
        cwd=tmp_path, env=env, capture_output=True, text=True, timeout=30,
    )
    assert result.returncode == 0, result.stdout + result.stderr
