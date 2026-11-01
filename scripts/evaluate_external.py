"""Evaluate an explicitly licensed article-task CSV; never merge claim-task labels."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

import pandas as pd
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.inference import Classifier
from scripts.data_pipeline import clean_text, prepare_articles
from scripts.evaluate import measure


def validate_manifest(manifest):
    if manifest.get("task") != "article_classification": raise ValueError("External evaluation requires article_classification data; claim/evidence labels cannot be merged.")
    if not manifest.get("source_url") or not manifest.get("license") or manifest.get("license_reviewed") is not True: raise ValueError("Record source URL, license and an explicit license review before evaluation.")
    if manifest.get("label_mapping") != {"0": "fake", "1": "real"}: raise ValueError("External labels must explicitly map 0=fake, 1=real for this article-task evaluator.")


def evaluate(csv, manifest_path, output):
    manifest = json.loads(manifest_path.read_text()); validate_manifest(manifest)
    frame = pd.read_csv(csv, on_bad_lines="error")
    if not {"title", "text", "label"}.issubset(frame.columns): raise ValueError("External CSVs require title, text, label.")
    if frame[["text", "label"]].isna().any().any(): raise ValueError("Missing external text/labels must be resolved explicitly.")
    if not set(frame.label).issubset({0, 1}): raise ValueError("Only declared binary article labels are accepted.")
    frame["content"] = frame.title.fillna("").map(clean_text) + " " + frame.text.map(clean_text)
    import re
    normalize = lambda value: re.sub(r"\W+", " ", value.lower()).strip()
    frame["key"] = frame.content.map(normalize)
    original, _ = prepare_articles(ROOT / "data/Fake.csv", ROOT / "data/True.csv")
    overlap = frame.key.isin(original.key)
    excluded = int(overlap.sum()); frame = frame[~overlap].copy()
    conflict = frame.groupby("key").label.nunique()
    if (conflict > 1).any(): raise ValueError("External content has conflicting labels; resolve them before scoring.")
    frame = frame.drop_duplicates("key")
    if len(frame) < 40 or frame.label.nunique() != 2: raise ValueError("At least 40 external articles across both labels are required.")
    runtime = Classifier(ROOT / "models/classifier.json")
    results = {}
    for model in ["logistic", "svm"]:
        values = np.array([runtime.predict(text, model)["real_probability"] for text in frame.content])
        results[model] = measure(frame.label.to_numpy(), values)
    report = {"manifest": manifest, "csv_sha256": hashlib.sha256(csv.read_bytes()).hexdigest(), "examples": len(frame), "exact_training_corpus_overlaps_excluded": excluded, "models": results, "limitations": ["Exact normalized overlap removal does not establish semantic or publisher independence.", "The manifest's source/license declarations are supplied by the dataset owner, not authenticated by this script.", "Article classifier scores describe dataset labels rather than factual certainty."]}
    output.parent.mkdir(exist_ok=True, parents=True); output.write_text(json.dumps(report, indent=2))
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=ROOT / "reports/external-evaluation.json")
    args = parser.parse_args()
    result = evaluate(args.csv, args.manifest, args.output)
    print(json.dumps({"examples": result["examples"], "models": {name: value["accuracy"] for name, value in result["models"].items()}}))
