"""Transparent aggregation. No weighted truth probability or fabricated modalities."""
from backend.schemas import AnalysisReport


def aggregate_reader_findings(findings):
    support = any(item.assessment in {"SUPPORTED", "MIXED"} and item.citations for item in findings)
    refutation = any(item.assessment in {"REFUTED", "MIXED"} and item.citations for item in findings)
    return "MIXED" if support and refutation else "SUPPORTED" if support else "REFUTED" if refutation else "INSUFFICIENT_EVIDENCE"


def fuse(analysis, media=None, findings=None):
    findings = findings or []
    modalities = {"text": "analyzed", "image_ocr": "not_requested", "image_visual": "VISUAL_ANALYSIS_UNAVAILABLE", "video_speech": "not_requested", "video_frames": "not_requested", "video_frame_ocr": "not_requested", "media_authenticity": "not_analyzed"}
    warnings = list(analysis.get("reasons", []))
    conflicts = []
    if media:
        if media.visual_consistency:
            modalities["image_visual"] = "client_relative_visual_comparison_supplied"
            warnings.append("Visual-language scores compare descriptions only; they are not factual-truth or authenticity probabilities.")
        if media.provenance:
            modalities["content_credentials"] = f"client_reported_{media.provenance.status}; signer trust not checked"
        if media.kind == "image": modalities["image_ocr"] = "client_extraction_reviewed"
        elif media.kind == "audio":
            modalities["audio_speech"] = "client_transcript_reviewed" if media.segments else "not_analyzed"
            modalities["audio_acoustic"] = "not_analyzed"
            warnings.append("Only reviewed speech words were classified. No trained acoustic misinformation or synthetic-speech detector is deployed.")
        else:
            modalities["video_speech"] = "client_transcript_reviewed" if media.segments else "not_analyzed"
            modalities["video_frames"] = "client_samples_inspected" if media.frames else "not_analyzed"
            modalities["video_frame_ocr"] = "client_extraction_reviewed" if any(frame.ocr_status == "text_found" for frame in media.frames) else "no_text_or_unavailable"
            modalities["video_visual_consistency"] = "client_relative_frame_comparison_supplied" if any(frame.visual_consistency for frame in media.frames) else "VISUAL_ANALYSIS_UNAVAILABLE"
            if any(frame.ocr_status == "failed" for frame in media.frames): warnings.append("OCR failed on one or more sampled frames.")
            if not media.frames: warnings.append("No visual-frame observations were supplied; transcription does not verify a video.")
        warnings.extend(media.warnings)
        warnings.append("Media observations were supplied by the browser and are not independently authenticated by this API.")
    if analysis.get("verdict") != "uncertain": conflicts.append("A confident writing-pattern score can coexist with insufficient factual evidence.")
    warnings.append("No independently validated factual-verification or deepfake verdict is established by this report.")
    assessment = aggregate_reader_findings(findings)
    if findings: warnings.append("Reader-authored findings/citations are not independently authenticated or verified by this server.")
    if assessment == "MIXED": conflicts.append("Reader annotations include both support and refutation across the listed claims; inspect each claim separately.")
    verification = {"assessment": assessment, "assessment_author": "reader" if findings else "not_verified", "claims": analysis.get("claims", []), "findings": [item.model_dump() for item in findings], "confidence": None, "explanation": "Reader-authored citation annotations are aggregated without a truth probability. Inspect each source and claim." if findings else "Candidate statements require relevant cited evidence and review; article-classifier scores do not verify them."}
    media_classification = None if media is None else {"verdict": "uncertain", "confidence": None, "status": "not_evaluated", "explanation": f"No independently evaluated full-{media.kind} fake-news classifier is deployed. The displayed text prediction covers reviewed words only; visual/acoustic observations do not determine this classification."}
    return AnalysisReport(content_classification=analysis, claim_verification=verification, modalities=modalities, conflicting_signals=conflicts, uncertainty=warnings, observations_origin="browser-submitted review metadata" if media or findings else "server text analysis", prediction_scope="reviewed_media_text" if media else "article_text", media_classification=media_classification).model_dump()
