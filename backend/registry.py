"""Lightweight metadata-only model registry; no remote downloads on startup."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def file_sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""): digest.update(block)
    return digest.hexdigest()


def registry():
    path = ROOT / "models/registry.json"
    return json.loads(path.read_text()) if path.exists() else {"schema_version": 1, "models": []}


def promotion_decision(candidate, baseline):
    reasons = []
    if candidate.get("test_examples", 0) < 500: reasons.append("At least 500 independent held-out test examples are required.")
    if not candidate.get("independent_source_evaluation"): reasons.append("An independent-source evaluation is required.")
    if not candidate.get("same_test_set_as_baseline"): reasons.append("A comparison on the same held-out examples is required.")
    if candidate.get("macro_f1", 0) < baseline.get("macro_f1", 1): reasons.append("Macro F1 must meet the baseline.")
    if candidate.get("brier_score", 1) > baseline.get("brier_score", 0): reasons.append("Calibration must not regress against the baseline.")
    if candidate.get("p95_latency_ms", float("inf")) > 1000: reasons.append("P95 local inference must be at most 1000 ms on the target device.")
    return {"eligible": not reasons, "reasons": reasons, "automatic_promotion": False}


def selected_model(bundle, root=None):
    """Use a checksummed release manifest; never select by article confidence."""
    root = Path(root) if root else ROOT
    try:
        manifest = json.loads((root / 'models/selection.json').read_text())
        if manifest['artifact_sha256'] != file_sha256(root / 'models/classifier.json'):
            raise ValueError('Artifact checksum mismatch')
        winner = manifest['selected_model']
        if winner not in bundle['models']:
            raise ValueError('Missing selected model')
        return winner, manifest
    except (OSError, ValueError, KeyError):
        # Preserve the existing production baseline when a selection release is
        # unavailable. Never reinterpret historical test scores as selection data.
        return 'logistic', {'status': 'baseline_fallback', 'selected_model': 'logistic',
                            'reason': 'Selection manifest unavailable or invalid; retaining the existing production baseline.'}
