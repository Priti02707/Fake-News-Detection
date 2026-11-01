"""Record immutable Hugging Face revisions; run explicitly, not during web builds."""
import json
from pathlib import Path
from huggingface_hub import model_info

ROOT = Path(__file__).resolve().parents[1]
MODELS = {"semantic": "Xenova/all-MiniLM-L6-v2", "nli": "Xenova/nli-deberta-v3-xsmall", "visual": "Xenova/clip-vit-base-patch32", "speech_en": "onnx-community/whisper-tiny.en", "speech_hi": "onnx-community/whisper-tiny"}
if __name__ == "__main__":
    result = {key: {"id": name, "revision": model_info(name).sha} for key, name in MODELS.items()}
    (ROOT / "models/browser-models.json").write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))
