"""Train article classifiers, calibrate on validation, export portable parameters."""
import argparse
import hashlib
import json
import platform
import re
import time
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, confusion_matrix, brier_score_loss
from sklearn.model_selection import GroupShuffleSplit
from sklearn.svm import LinearSVC

ROOT = Path(__file__).resolve().parents[1]


def normalized(text):
    return re.sub(r"\W+", " ", str(text).lower()).strip()


def train(fake_path, real_path):
    frames = []
    hashes = {}
    for path, label in [(fake_path, 0), (real_path, 1)]:
        hashes[path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
        frame = pd.read_csv(path, on_bad_lines="error").fillna("")
        if not {"title", "text"}.issubset(frame.columns):
            raise ValueError("Each CSV must contain title and text columns")
        frame["label"] = label
        frames.append(frame)
    data = pd.concat(frames, ignore_index=True)
    original = len(data)
    data["content"] = data["title"].astype(str) + " " + data["text"].astype(str)
    data["key"] = data.content.map(normalized)
    data = data[data.key.str.len() >= 60].copy()
    conflicts = data.groupby("key").label.nunique()
    data = data[~data.key.isin(conflicts[conflicts > 1].index)].drop_duplicates("key").reset_index(drop=True)
    # Keep repeated normalized headlines together across all three partitions.
    data["group"] = data.title.map(normalized)
    data.loc[data.group.str.len() < 12, "group"] = data.loc[data.group.str.len() < 12, "key"]
    split = GroupShuffleSplit(n_splits=1, test_size=.2, random_state=42)
    rest, test = next(split.split(data, groups=data.group))
    train_rel, val_rel = next(GroupShuffleSplit(n_splits=1, test_size=.25, random_state=43).split(data.iloc[rest], groups=data.iloc[rest].group))
    train_idx, val_idx = rest[train_rel], rest[val_rel]
    assert not (set(data.iloc[train_idx].group) & set(data.iloc[test].group))
    import sys
    sys.path.insert(0, str(ROOT))
    from scripts.model_selection import select_candidates
    selection = select_candidates(data.iloc[train_idx].reset_index(drop=True))
    selection['data_sha256'] = hashes
    vector = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), min_df=2, max_df=.9, max_features=20000)
    Xtrain = vector.fit_transform(data.iloc[train_idx].content)
    Xval = vector.transform(data.iloc[val_idx].content)
    Xtest = vector.transform(data.iloc[test].content)
    ytrain, yval, ytest = [data.iloc[idx].label for idx in (train_idx, val_idx, test)]
    feature_names = vector.get_feature_names_out().tolist()
    exported, measurements = {}, []
    for key, name, model in [("logistic", "Logistic Regression", LogisticRegression(max_iter=2500, class_weight="balanced", random_state=42)), ("svm", "Linear SVM", LinearSVC(max_iter=5000, class_weight="balanced", random_state=42))]:
        model.fit(Xtrain, ytrain)
        calibration = LogisticRegression(C=1e6, max_iter=2000, random_state=42)
        calibration.fit(model.decision_function(Xval).reshape(-1, 1), yval)
        start = time.perf_counter()
        probabilities = calibration.predict_proba(model.decision_function(Xtest).reshape(-1, 1))[:, 1]
        elapsed = (time.perf_counter() - start) * 1000 / len(test)
        predicted = (probabilities >= .5).astype(int)
        confident = (probabilities <= .2) | (probabilities >= .8)
        measurements.append({"id": key, "name": name, "accuracy": float(accuracy_score(ytest, predicted)), "macro_f1": float(f1_score(ytest, predicted, average="macro")), "brier_score": float(brier_score_loss(ytest, probabilities)), "errors": int((predicted != ytest).sum()), "confusion_matrix": confusion_matrix(ytest, predicted, labels=[0, 1]).tolist(), "scoring_ms_per_article": round(elapsed, 4), "coverage": float(confident.mean()), "selective_accuracy": float(accuracy_score(ytest.to_numpy()[confident], predicted[confident])) if confident.any() else None})
        exported[key] = {"name": name, "coef": model.coef_[0].round(10).tolist(), "intercept": float(model.intercept_[0]), "calibration_coef": float(calibration.coef_[0, 0]), "calibration_intercept": float(calibration.intercept_[0])}
    metadata = {"dataset": "Recovered original project samples", "source_commit": "afe1eb8", "input_rows": original, "usable_rows": len(data), "removed_rows": original - len(data), "splits": {"train": len(train_idx), "calibration": len(val_idx), "test": len(test)}, "test_class_counts": {"fake": int((ytest == 0).sum()), "real": int((ytest == 1).sum())}, "protocol": "Normalized content deduplication; conflicting labels removed; normalized headline groups held together; 60/20/20 group split; vectorizer fitted on training only; sigmoid calibration fitted on validation only. No publisher or temporal holdout.", "seed": [42, 43], "versions": {"python": platform.python_version(), "sklearn": sklearn.__version__, "numpy": np.__version__, "pandas": pd.__version__}, "data_sha256": hashes, "models": measurements, "limits": ["Historical English articles; not evaluated on Hindi, short claims, or current events.", "Publisher and writing-style cues may inflate in-domain scores.", "Grouped holdout does not remove all semantic near-duplicates.", "Classifier probabilities describe dataset labels, not verified factual truth.", "Latency measures sparse matrix scoring plus calibration, excluding text processing and network time."]}
    bundle = {"schema_version": 1, "features": feature_names, "idf": vector.idf_.round(10).tolist(), "stop_words": sorted(vector.get_stop_words()), "models": exported, "metadata": metadata}
    destination = ROOT / "models"
    destination.mkdir(exist_ok=True)
    (destination / "classifier.json").write_text(json.dumps(bundle, separators=(",", ":")))
    (destination / "metrics.json").write_text(json.dumps(metadata, indent=2))
    selection['artifact_sha256'] = hashlib.sha256((destination / 'classifier.json').read_bytes()).hexdigest()
    (destination / 'selection.json').write_text(json.dumps(selection, indent=2) + '\n')
    # Verify the deployed, dependency-light implementation against sklearn.
    import sys
    sys.path.insert(0, str(ROOT))
    from backend.inference import Classifier
    runtime = Classifier(destination / "classifier.json")
    for key in exported:
        samples = data.iloc[test[:25]].content.tolist()
        model_export = exported[key]
        matrix = vector.transform(samples)
        scores = matrix @ np.array(model_export["coef"]) + model_export["intercept"]
        expected_probs = 1 / (1 + np.exp(-(scores * model_export["calibration_coef"] + model_export["calibration_intercept"])))
        actual_probs = [runtime.predict(sample, key)["real_probability"] for sample in samples]
        assert np.allclose(expected_probs, actual_probs, atol=1e-7), "Export parity failed"
    print(json.dumps(metadata, indent=2))
    print("Export parity verified for both models on 25 held-out articles.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--fake", type=Path, default=ROOT / "data/Fake.csv")
    parser.add_argument("--real", type=Path, default=ROOT / "data/True.csv")
    args = parser.parse_args()
    train(args.fake, args.real)
