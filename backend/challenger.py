"""Opt-in local transformer inference. Never imported by the Vercel API."""
import json
from pathlib import Path


class TransformerChallenger:
    def __init__(self, directory: Path):
        import torch
        from transformers import AutoTokenizer, AutoModelForSequenceClassification
        self.torch = torch
        self.metadata = json.loads((directory / "evaluation.json").read_text())
        self.tokenizer = AutoTokenizer.from_pretrained(directory, local_files_only=True, trust_remote_code=False)
        self.model = AutoModelForSequenceClassification.from_pretrained(directory, local_files_only=True, trust_remote_code=False).eval()

    def predict(self, text):
        if not 10 <= len(text) <= 20000: raise ValueError("Research inference accepts between 10 and 20000 characters.")
        tokens = self.tokenizer(text, return_tensors="pt", truncation=True, max_length=self.metadata["config"]["max_length"])
        with self.torch.no_grad(): logits = self.model(**tokens).logits[0].tolist()
        slope, intercept = self.metadata["calibration"]["coefficient"], self.metadata["calibration"]["intercept"]
        import math
        probability = 1 / (1 + math.exp(-max(-35, min(35, slope * (logits[1] - logits[0]) + intercept))))
        return {"verdict": "uncertain", "confidence": None, "research_score": probability, "deployment_status": "research_only", "calibration_validated_for_production": False, "warning": "A research score, not factual certainty or an approved production model."}
