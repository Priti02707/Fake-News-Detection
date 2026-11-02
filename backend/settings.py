"""Load a local server-only environment without overriding deployment settings."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_local_env(path=None):
    path = Path(path) if path else ROOT / '.env'
    if not path.exists():
        return
    # Deliberately no shell expansion, evaluation, interpolation, or logging.
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        key, value = key.strip(), value.strip()
        if key in {'GROQ_API_KEY', 'GROQ_MODEL', 'GOOGLE_FACT_CHECK_API_KEY'}:
            if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
                value = value[1:-1]
            os.environ.setdefault(key, value)


load_local_env()
