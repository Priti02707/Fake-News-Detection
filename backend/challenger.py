"""Opt-in local transformer inference. Never imported by the Vercel API."""
import json
import math
from pathlib import Path
from backend.registry import file_sha256


def verified_metadata(directory: Path):
    """Check the local benchmark manifest before importing/loading model code."""
    directory = directory.resolve(strict=True)
    metadata = json.loads((directory / "evaluation.json").read_text())
    artifacts = metadata.get("artifacts", {})
    required = {"config.json", "tokenizer_config.json", "model.safetensors"}
    if not required.issubset(artifacts):
        raise ValueError("The checkpoint manifest lacks required safe model artifacts.")
    for name, record in artifacts.items():
        # Older repeated benchmark runs listed the *previous* evaluation report.
        # A report cannot verify its own hash; verify all model/tokenizer files.
        if name == "evaluation.json":
            continue
        path = (directory / name).resolve(strict=True)
        if not path.is_relative_to(directory) or not path.is_file():
            raise ValueError("A checkpoint artifact is outside its directory.")
        if path.stat().st_size != record["bytes"] or file_sha256(path) != record["sha256"]:
            raise ValueError("A checkpoint artifact failed checksum verification.")
    maximum = metadata["config"]["max_length"]
    if type(maximum) is not int or not 8 <= maximum <= 512:
        raise ValueError("Unsupported checkpoint token limit.")
    for key in ("coefficient", "intercept"):
        if not math.isfinite(float(metadata["calibration"][key])):
            raise ValueError("Invalid calibration parameters.")
    if not metadata.get("model") or not metadata.get("revision"):
        raise ValueError("Checkpoint model identity and revision are required.")
    return metadata


class TransformerChallenger:
    def __init__(self, directory: Path):
        self.metadata = verified_metadata(directory)
        import torch
        from transformers import AutoTokenizer, AutoModelForSequenceClassification
        self.torch = torch
        # Bounded CPU parallelism for the optional single-process local service.
        torch.set_num_threads(min(4, torch.get_num_threads()))
        self.tokenizer = AutoTokenizer.from_pretrained(directory, local_files_only=True, trust_remote_code=False)
        self.model = AutoModelForSequenceClassification.from_pretrained(directory, local_files_only=True, trust_remote_code=False, use_safetensors=True).eval()
        if self.model.config.num_labels != 2:
            raise ValueError("The article challenger must have two dataset-label outputs.")

    def predict(self, text):
        if not 10 <= len(text) <= 20000: raise ValueError("Research inference accepts between 10 and 20000 characters.")
        tokens = self.tokenizer(text, return_tensors="pt", truncation=True, max_length=self.metadata["config"]["max_length"])
        with self.torch.no_grad(): logits = self.model(**tokens).logits[0].tolist()
        slope, intercept = self.metadata["calibration"]["coefficient"], self.metadata["calibration"]["intercept"]
        if len(logits) != 2 or not all(math.isfinite(value) for value in logits):
            raise ValueError("The checkpoint produced invalid logits.")
        probability = 1 / (1 + math.exp(-max(-35, min(35, slope * (logits[1] - logits[0]) + intercept))))
        return {"verdict": "uncertain", "confidence": None, "research_score": probability, "model": self.metadata["model"], "revision": self.metadata["revision"], "max_tokens": self.metadata["config"]["max_length"], "deployment_status": "research_only", "calibration_validated_for_production": False, "warning": "A research score for dataset label 1 (real-labeled article), not factual certainty or an approved production model. Input is truncated to the checkpoint token limit; transformer attribution is unavailable."}
