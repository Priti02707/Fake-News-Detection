import asyncio
import re
import time
from fastapi import APIRouter, HTTPException
from starlette.concurrency import run_in_threadpool

from backend.schemas import AnalyzeInput, TextV2Input, URLInput, MultimodalInput, VerifyInput, EvidenceInput, AnalysisEnvelope, VerificationResponse
from backend.language import identify_language
from backend.fusion import fuse
from backend.registry import registry


def build_router(analyze, extract, retrieve, metrics, evaluation):
    router = APIRouter(prefix="/api/v2")

    def classify(payload):
        started = time.perf_counter()
        words = re.findall(r"\b\w+\b", payload.text)
        if len(payload.text.strip()) < 40 or len(words) < 40:
            return {"verdict": "uncertain", "model": payload.model, "model_name": "Linear SVM" if payload.model == "svm" else "Logistic Regression", "confidence": None, "real_probability": None, "explanations": [], "reasons": ["Headline or short text: the article classifiers were evaluated on full articles. Provide more context or investigate this claim with sources."], "word_count": len(words), "elapsed_ms": round((time.perf_counter() - started) * 1000, 2), "language": identify_language(payload.text), "claims": [{"text": payload.text.strip()[:300], "status": "unverified", "selection_method": "short_input_for_reader_review"}], "note": "No factual or calibrated classification score is established for this short input."}
        return analyze(AnalyzeInput(text=payload.text, model=payload.model))

    @router.post("/analyze/text", response_model=AnalysisEnvelope)
    def text_analysis(payload: TextV2Input):
        result = classify(payload)
        return {"analysis": result, "report": fuse(result, findings=payload.reader_findings)}

    @router.post("/analyze/url", response_model=AnalysisEnvelope)
    async def url_analysis(payload: URLInput):
        source = await extract(payload)
        result = await run_in_threadpool(classify, TextV2Input(text=source["text"], model="logistic"))
        return {"source": source, "analysis": result, "report": fuse(result)}

    def reviewed_media(payload, expected):
        if payload.media.kind != expected: raise HTTPException(422, "The media kind does not match this endpoint.")
        result = classify(payload)
        return {"analysis": result, "report": fuse(result, payload.media, payload.reader_findings)}

    @router.post("/analyze/image", response_model=AnalysisEnvelope)
    def image_analysis(payload: MultimodalInput):
        return reviewed_media(payload, "image")

    @router.post("/analyze/video", response_model=AnalysisEnvelope)
    def video_analysis(payload: MultimodalInput):
        return reviewed_media(payload, "video")

    @router.post("/analyze/audio", response_model=AnalysisEnvelope)
    def audio_analysis(payload: MultimodalInput):
        return reviewed_media(payload, "audio")

    @router.post("/verify/claims", response_model=VerificationResponse)
    async def verify(payload: VerifyInput):
        evidence, warnings = [], []
        if payload.source_text:
            evidence.append(await retrieve(EvidenceInput(query=payload.claim, text=payload.source_text)))
        for url in payload.urls:
            try:
                evidence.append(await asyncio.wait_for(retrieve(EvidenceInput(query=payload.claim, url=url)), timeout=10))
            except (HTTPException, TimeoutError) as error:
                warnings.append(error.detail if isinstance(error, HTTPException) else "Source retrieval timed out.")
        return {"claim": payload.claim, "assessment": "INSUFFICIENT_EVIDENCE", "confidence": None, "evidence": evidence, "warnings": warnings, "explanation": "Retrieved passages are available for review. No server-side factual-verification model has passed domain validation. Optional browser NLI compares wording; reader annotations remain explicitly reader-authored."}

    @router.get("/models/metrics")
    def model_metrics():
        return {"baseline": metrics(), "robustness": evaluation(), "registry": registry()}

    @router.get("/capabilities")
    def capabilities():
        return {"media_execution": "asynchronous browser workers", "raw_media_uploads": False, "server_media_jobs": False, "maximum_video_seconds": 60, "maximum_video_bytes": 25 * 1024 * 1024, "maximum_audio_seconds": 60, "maximum_audio_bytes": 20 * 1024 * 1024, "maximum_frames": 6, "production_text_models": ["logistic", "svm"], "transformer_challengers": "local research only", "deepfake_detection": "unavailable", "claim_verification": "cited retrieval plus reader review; browser textual-entailment assistance is experimental", "classification": {"text": "evaluated English article models", "url": "reviewed article text", "image": "reviewed text only; full-image classifier not evaluated", "video": "reviewed text only; full-video classifier not evaluated", "audio": "reviewed speech text only; acoustic classifier not evaluated", "multimodal_fusion": "research training only; no production checkpoint", "hindi": "extraction only; veracity classifier unavailable"}}

    return router
