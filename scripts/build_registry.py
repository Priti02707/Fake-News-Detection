"""Register measured metadata only. Does not change a production artifact."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.registry import file_sha256


def main():
    baseline = json.loads((ROOT / "models/metrics.json").read_text())
    artifact = ROOT / "models/classifier.json"
    entries = [{"name": item["name"], "id": item["id"], "architecture": "TF-IDF calibrated linear classifier", "deployment_status": "production", "artifact": "models/classifier.json", "artifact_sha256": file_sha256(artifact), "artifact_bytes_shared_bundle": artifact.stat().st_size, "trained_at": None, "timestamp_note": "The original exporter did not record a training timestamp; it is not reconstructed from file mtime.", "training_dataset": baseline["dataset"], "source_data_sha256": baseline["data_sha256"], "seeds": baseline["seed"], "versions": baseline["versions"], "split_methodology": baseline["protocol"], "metrics": item} for item in baseline["models"]]
    for path in sorted((ROOT / "reports").glob("transformer-*.json")):
        report = json.loads(path.read_text())
        if not isinstance(report.get("metrics"), dict): continue
        entries.append({"name": report["model"], "id": report["model"].split("/")[-1], "architecture": "Transformer sequence classifier", "revision": report["revision"], "deployment_status": "research_only", "artifact": f".artifacts/{report['model'].split('/')[-1]}", "artifact_bytes": report["artifact_bytes"], "artifact_checksums": report["artifacts"], "trained_at": report["trained_at"], "training_dataset": baseline["dataset"], "source_data_sha256": report["source_sha256"], "config": report["config"], "versions": report["versions"], "splits": report["splits"], "metrics": report["metrics"], "latency": report["latency"], "promotion": report["promotion"], "limitations": report["limitations"]})
    result = {"schema_version": 1, "models": entries, "promotion_policy": "Manual review only; at least 500 independent test examples, same-test-set comparison, independent sources, no macro-F1/Brier regression, and target-hardware latency under the declared budget."}
    (ROOT / "models/registry.json").write_text(json.dumps(result, indent=2))
    print(json.dumps({"registered": len(entries), "production_changed": False}))


if __name__ == "__main__": main()
