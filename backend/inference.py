"""Portable sklearn-compatible TF-IDF + calibrated linear inference."""
import json
import math
import re
from collections import Counter
from pathlib import Path


class Classifier:
    def __init__(self, path: Path):
        self.bundle = json.loads(path.read_text())
        self.vocab = {feature: i for i, feature in enumerate(self.bundle["features"])}
        self.stops = set(self.bundle["stop_words"])

    def predict(self, text: str, model_id: str = "logistic"):
        model = self.bundle["models"][model_id]
        tokens = [word for word in re.findall(r"(?u)\b\w\w+\b", text.lower()) if word not in self.stops]
        features = tokens + [f"{a} {b}" for a, b in zip(tokens, tokens[1:])]
        counts = Counter(features)
        weights = {self.vocab[f]: count * self.bundle["idf"][self.vocab[f]] for f, count in counts.items() if f in self.vocab}
        norm = math.sqrt(sum(v * v for v in weights.values())) or 1
        contributions = [(self.bundle["features"][idx], value / norm * model["coef"][idx]) for idx, value in weights.items()]
        score = model["intercept"] + sum(value for _, value in contributions)
        calibrated = max(-35, min(35, score * model["calibration_coef"] + model["calibration_intercept"]))
        probability = 1 / (1 + math.exp(-calibrated))
        top = sorted(contributions, key=lambda pair: abs(pair[1]), reverse=True)[:12]
        return {"real_probability": probability, "known_feature_ratio": len(weights) / max(1, len(counts)), "explanations": [{"term": term, "weight": round(value, 5), "direction": "real" if value >= 0 else "fake"} for term, value in top]}
