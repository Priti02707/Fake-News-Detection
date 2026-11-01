"""Fallible language identification, kept distinct from factual classification."""
from langdetect import DetectorFactory, LangDetectException, detect_langs

DetectorFactory.seed = 0


def identify_language(text):
    try:
        candidates = detect_langs(text[:5000])
        top = candidates[0]
        return {"code": top.lang, "score": round(top.prob, 4), "method": "langdetect; heuristic language score, not factual certainty"}
    except (LangDetectException, IndexError):
        return {"code": "unknown", "score": None, "method": "langdetect could not identify a language"}
