"""Reproducible holdout/stress evaluation. Never overwrites production weights.

Held-out results in this script MUST NOT choose the production model.
Run scripts/train.py for nested training-only CV selection and release manifest.
"""
import argparse
import hashlib
import json
import re
import platform
import time
import pickle
import sklearn
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, balanced_accuracy_score, brier_score_loss, confusion_matrix, f1_score, precision_recall_fscore_support, roc_auc_score, average_precision_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.neighbors import NearestNeighbors
from sklearn.svm import LinearSVC

ROOT = Path(__file__).resolve().parents[1]


def load_data(fake, real):
    frames = []
    for path, label in [(fake, 0), (real, 1)]:
        frame = pd.read_csv(path, on_bad_lines="error").fillna("")
        frame["label"] = label
        frames.append(frame)
    data = pd.concat(frames, ignore_index=True)
    data["content"] = data.title.astype(str) + " " + data.text.astype(str)
    normalize = lambda value: re.sub(r"\W+", " ", str(value).lower()).strip()
    data["key"] = data.content.map(normalize)
    data = data[data.key.str.len() >= 60].copy()
    conflict = data.groupby("key").label.nunique()
    data = data[~data.key.isin(conflict[conflict > 1].index)].drop_duplicates("key").reset_index(drop=True)
    data["group"] = data.title.map(normalize)
    data.loc[data.group.str.len() < 12, "group"] = data.loc[data.group.str.len() < 12, "key"]
    return data


def temporal_split(data):
    dates = pd.to_datetime(data.date.str.strip(), format="mixed", errors="coerce", utc=True)
    valid = data.loc[dates.notna()].copy()
    valid["parsed_date"] = dates[dates.notna()]
    valid = valid.sort_values("parsed_date")
    if len(valid) < 100: raise ValueError("Too few valid dates for a temporal experiment.")
    boundary1 = valid.parsed_date.iloc[int(len(valid) * .6)]
    boundary2 = valid.parsed_date.iloc[int(len(valid) * .8)]
    train = valid[valid.parsed_date < boundary1].index.to_numpy()
    calibration = valid[(valid.parsed_date >= boundary1) & (valid.parsed_date < boundary2)].index.to_numpy()
    test = valid[valid.parsed_date >= boundary2].index.to_numpy()
    seen = set(data.loc[train, "group"])
    calibration = np.array([index for index in calibration if data.loc[index, "group"] not in seen], dtype=int)
    seen.update(data.loc[calibration, "group"])
    test = np.array([index for index in test if data.loc[index, "group"] not in seen], dtype=int)
    for indices in [train, calibration, test]:
        if len(indices) < 20 or data.loc[indices, "label"].nunique() < 2: raise ValueError("Every temporal partition must contain both labels and at least 20 examples.")
    return (train, calibration, test), {"training_before": boundary1.isoformat(), "test_from": boundary2.isoformat(), "invalid_dates_excluded": int(dates.isna().sum())}



def publisher_split(data, column):
    if data[column].isna().any() or data[column].astype(str).str.strip().eq("").any(): raise ValueError("Publisher metadata must be present for every article.")
    rest, test = next(GroupShuffleSplit(n_splits=1, test_size=.2, random_state=42).split(data, groups=data[column]))
    train_rel, cal_rel = next(GroupShuffleSplit(n_splits=1, test_size=.25, random_state=43).split(data.iloc[rest], groups=data.iloc[rest][column]))
    train, cal = rest[train_rel], rest[cal_rel]
    seen = set(data.iloc[train].group)
    cal = np.array([index for index in cal if data.iloc[index].group not in seen], dtype=int)
    seen.update(data.iloc[cal].group)
    test = np.array([index for index in test if data.iloc[index].group not in seen], dtype=int)
    for indices in [train, cal, test]:
        if len(indices) < 20 or data.iloc[indices].label.nunique() != 2: raise ValueError("Publisher partitions require both labels and at least 20 examples.")
    return train, cal, test


def measure(labels, probabilities):
    labels, probabilities = np.asarray(labels), np.asarray(probabilities)
    predicted = probabilities >= .5
    confidence = np.maximum(probabilities, 1 - probabilities)
    correct = predicted == labels
    bins, ece = [], 0.
    for lower in np.arange(.5, 1, .05):
        upper = min(1., lower + .05)
        selected = (confidence >= lower) & (confidence < upper if upper < .999999 else confidence <= 1)
        if not selected.any(): continue
        accuracy, mean_confidence = float(correct[selected].mean()), float(confidence[selected].mean())
        ece += float(selected.mean()) * abs(accuracy - mean_confidence)
        bins.append({"lower": round(float(lower), 2), "upper": round(float(upper), 2), "count": int(selected.sum()), "accuracy": accuracy, "confidence": mean_confidence})
    selected = confidence >= .8
    precision, recall, f1, support = precision_recall_fscore_support(labels, predicted, labels=[0, 1], zero_division=0)
    rng = np.random.default_rng(42)
    boot_accuracy, boot_f1 = [], []
    for _ in range(200):
        sample = rng.integers(0, len(labels), len(labels))
        actual, prediction = labels[sample], predicted[sample]
        boot_accuracy.append(float((actual == prediction).mean()))
        class_f1 = []
        for value in [0, 1]:
            tp = int(((actual == value) & (prediction == value)).sum())
            fp = int(((actual != value) & (prediction == value)).sum())
            fn = int(((actual == value) & (prediction != value)).sum())
            class_f1.append(2 * tp / max(1, 2 * tp + fp + fn))
        boot_f1.append(float(np.mean(class_f1)))
    observed = float(correct.mean()); z = 1.959963984540054; n = len(labels)
    denominator = 1 + z * z / n
    centre = (observed + z * z / (2 * n)) / denominator
    radius = z * float(np.sqrt(observed * (1 - observed) / n + z * z / (4 * n * n))) / denominator
    extra = {"accuracy_wilson_95": [max(0., centre - radius), min(1., centre + radius)], "per_class": {name: {"precision": float(precision[index]), "recall": float(recall[index]), "f1": float(f1[index]), "support": int(support[index])} for index, name in enumerate(["fake", "real"])}, "roc_auc": float(roc_auc_score(labels, probabilities)) if len(set(labels)) == 2 else None, "pr_auc_real": float(average_precision_score(labels, probabilities)) if len(set(labels)) == 2 else None, "bootstrap_95": {"accuracy": np.quantile(boot_accuracy, [.025, .975]).tolist(), "macro_f1": np.quantile(boot_f1, [.025, .975]).tolist(), "resamples": 200, "seed": 42, "note": "Article bootstrap within this fixed split; source/event dependence is not accounted for."}}
    return {**extra, "n": len(labels), "accuracy": float(accuracy_score(labels, predicted)), "balanced_accuracy": float(balanced_accuracy_score(labels, predicted)), "macro_f1": float(f1_score(labels, predicted, average="macro")), "brier_score": float(brier_score_loss(labels, probabilities)), "ece": ece, "reliability_bins": bins, "confusion_matrix": confusion_matrix(labels, predicted, labels=[0, 1]).tolist(), "errors": int((~correct).sum()), "score_threshold_coverage": float(selected.mean()), "selective_accuracy": float(correct[selected].mean()) if selected.any() else None}


def run_experiment(data, indices, name):
    train, calibration, test = indices
    assert not (set(data.loc[train, "group"]) & set(data.loc[test, "group"]))
    assert not (set(data.loc[train, "group"]) & set(data.loc[calibration, "group"]))
    assert not (set(data.loc[calibration, "group"]) & set(data.loc[test, "group"]))
    vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), min_df=2, max_df=.9, max_features=20000)
    training = vectorizer.fit_transform(data.loc[train, "content"])
    validation = vectorizer.transform(data.loc[calibration, "content"])
    testing = vectorizer.transform(data.loc[test, "content"])
    nearest = NearestNeighbors(n_neighbors=1, metric="cosine", algorithm="brute").fit(training)
    similarities = 1 - nearest.kneighbors(testing, return_distance=True)[0].ravel()
    novel = similarities < .85
    results = []
    stripped = data.loc[test, "content"].str.replace(r"\b(?:Reuters|Associated Press|WASHINGTON|NEW YORK)\b", " ", regex=True, flags=re.I)
    for key, model in [("logistic", LogisticRegression(max_iter=2500, class_weight="balanced", random_state=42)), ("svm", LinearSVC(max_iter=5000, class_weight="balanced", random_state=42))]:
        model.fit(training, data.loc[train, "label"])
        calibrator = LogisticRegression(C=1e6, max_iter=2000, random_state=42).fit(model.decision_function(validation).reshape(-1, 1), data.loc[calibration, "label"])
        def predict(matrix): return calibrator.predict_proba(model.decision_function(matrix).reshape(-1, 1))[:, 1]
        before = time.perf_counter()
        probabilities = predict(testing)
        scoring_ms = (time.perf_counter() - before) * 1000 / len(test)
        result = {"id": key, "full_text": measure(data.loc[test, "label"], probabilities), "headline_only": measure(data.loc[test, "label"], predict(vectorizer.transform(data.loc[test, "title"]))), "selected_source_cues_removed": measure(data.loc[test, "label"], predict(vectorizer.transform(stripped)))}
        if novel.any() and data.loc[test[novel], "label"].nunique() == 2: result["lower_lexical_overlap"] = measure(data.loc[test[novel], "label"], probabilities[novel])
        altered = data.loc[test, "content"].str.replace(r"\bsaid\b", "stated", regex=True, flags=re.I).str.replace(r"\bannounced\b", "reported", regex=True, flags=re.I)
        result["wording_substitutions"] = measure(data.loc[test, "label"], predict(vectorizer.transform(altered)))
        result["sensational_prefix"] = measure(data.loc[test, "label"], predict(vectorizer.transform("BREAKING! SHOCKING! You will not believe this: " + data.loc[test, "content"])))
        result["irrelevant_source_markers"] = measure(data.loc[test, "label"], predict(vectorizer.transform("Published by Reuters and Associated Press in Washington. " + data.loc[test, "content"])))
        result["scoring_ms_per_article_in_batch"] = scoring_ms
        result["serialized_estimator_bundle_bytes"] = len(pickle.dumps((vectorizer, model, calibrator), protocol=5))
        results.append(result)
    return {"name": name, "splits": {"train": len(train), "calibration": len(calibration), "test": len(test)}, "class_counts": {label: data.loc[indices_, "label"].value_counts().sort_index().to_dict() for label, indices_ in zip(["train", "calibration", "test"], indices)}, "test_examples_with_training_cosine_at_least_085": int((~novel).sum()), "models": results}


def main(fake, real, output):
    data = load_data(fake, real)
    rest, test = next(GroupShuffleSplit(n_splits=1, test_size=.2, random_state=42).split(data, groups=data.group))
    relative_train, relative_cal = next(GroupShuffleSplit(n_splits=1, test_size=.25, random_state=43).split(data.iloc[rest], groups=data.iloc[rest].group))
    experiments = [run_experiment(data, (rest[relative_train], rest[relative_cal], test), "Grouped historical holdout")]
    from sklearn.model_selection import StratifiedGroupKFold
    outer = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)
    rest_s, test_s = next(outer.split(data, data.label, data.group))
    inner = StratifiedGroupKFold(n_splits=4, shuffle=True, random_state=43)
    train_s, cal_s = next(inner.split(data.iloc[rest_s], data.iloc[rest_s].label, data.iloc[rest_s].group))
    experiments.append(run_experiment(data, (rest_s[train_s], rest_s[cal_s], test_s), "Stratified headline-group holdout"))
    availability = {}
    if "date" in data:
        try:
            indices, boundaries = temporal_split(data)
            temporal = run_experiment(data, indices, "Temporal holdout with disjoint dates and headlines")
            temporal["boundaries"] = boundaries
            experiments.append(temporal)
            availability["temporal"] = "measured"
        except ValueError as error: availability["temporal"] = str(error)
    else: availability["temporal"] = "Unavailable: source data has no dates."
    column = next((name for name in ["publisher", "source"] if name in data), None)
    availability["publisher_holdout"] = "Not measured: original CSVs have no authenticated publisher identifiers."
    if column:
        try:
            indices = publisher_split(data, column)
            experiments.append(run_experiment(data, indices, f"Publisher-group holdout using provided {column} metadata"))
            availability["publisher_holdout"] = "Measured from provided metadata; publisher identity was not independently authenticated."
        except ValueError as error: availability["publisher_holdout"] = f"Not measured: {error}"
    availability["independent_dataset"] = "Not measured: an independent licensed evaluation dataset is required."
    report = {"schema_version": 1, "seeds": [42, 43], "versions": {"python": platform.python_version(), "sklearn": sklearn.__version__, "numpy": np.__version__, "pandas": pd.__version__}, "generated_at": datetime.now(timezone.utc).isoformat(), "usable_rows": len(data), "source_sha256": {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in [fake, real]}, "experiments": experiments, "availability": availability, "protocol": "Each experiment retrains both algorithms. TF-IDF fits training only; calibration uses its separate partition. Production weights are unchanged. Temporal boundaries use dates only, with later repeated headline groups removed. Lexical overlap screening uses train-fitted TF-IDF and a predeclared cosine threshold of 0.85.", "limits": ["These experiments remain within the historical source corpus; they are not current-news accuracy estimates.", "Lexical cosine screening is not semantic deduplication.", "Removing four selected source cues does not remove all publisher/style signals.", "Wording substitutions are deterministic lexical stress tests, not a human-validated paraphrase benchmark.", "Headline-only results are stress tests; the production app abstains on short input.", "Coverage here uses the model-score threshold only, not all application abstention rules.", "Claim selection is heuristic. Evidence relation models, Hindi extraction, OCR and ASR have not received domain-level accuracy evaluation."]}
    output.write_text(json.dumps(report, indent=2))
    print(json.dumps({"experiments": [{"name": item["name"], "splits": item["splits"], "models": [{"id": model["id"], "accuracy": model["full_text"]["accuracy"], "macro_f1": model["full_text"]["macro_f1"]} for model in item["models"]]} for item in experiments], "availability": availability}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--fake", type=Path, default=ROOT / "data/Fake.csv")
    parser.add_argument("--real", type=Path, default=ROOT / "data/True.csv")
    parser.add_argument("--output", type=Path, default=ROOT / "models/robustness.json")
    args = parser.parse_args()
    main(args.fake, args.real, args.output)
