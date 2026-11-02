from typing import Literal, Annotated
from pydantic import BaseModel, Field
from pydantic import model_validator


class AnalyzeInput(BaseModel):
    text: str = Field(min_length=40, max_length=20000)
    model: Literal["logistic", "svm"] = "logistic"


class URLInput(BaseModel):
    url: str = Field(min_length=8, max_length=2048)


class ClaimInput(BaseModel):
    query: str = Field(min_length=8, max_length=300)
    language: Literal["en", "hi"] = "en"


class EvidenceInput(BaseModel):
    query: str = Field(min_length=8, max_length=300)
    text: str | None = Field(default=None, min_length=40, max_length=20000)
    url: str | None = Field(default=None, min_length=8, max_length=2048)


class Segment(BaseModel):
    text: str = Field(max_length=3000)
    start: float | None = Field(default=None, ge=0, le=60)
    end: float | None = Field(default=None, ge=0, le=60)

    @model_validator(mode="after")
    def ordered_timestamps(self):
        if self.start is not None and self.end is not None and self.end < self.start:
            raise ValueError("Segment end must not precede its start.")
        return self


class VisualMatch(BaseModel):
    label: str = Field(min_length=1, max_length=200)
    score: float = Field(ge=0, le=1)


class VisualObservation(BaseModel):
    model: str = Field(max_length=100)
    revision: str = Field(max_length=64)
    matches: list[VisualMatch] = Field(min_length=2, max_length=2)
    scope: str = Field(max_length=300)
    claim: str | None = Field(default=None, max_length=200)
    alternative: str | None = Field(default=None, max_length=200)


class ProvenanceObservation(BaseModel):
    status: Literal["found", "not_found", "unavailable"]
    validation_state: str | None = Field(default=None, max_length=100)
    signer_trust: Literal["not_checked"] = "not_checked"


class Frame(BaseModel):
    id: str = Field(max_length=80)
    timestamp: float = Field(ge=0, le=60)
    width: int = Field(gt=0, le=960)
    height: int = Field(gt=0, le=2000)
    text: str = Field(default="", max_length=3000)
    ocr_status: Literal["text_found", "no_text", "failed"]
    visual_consistency: VisualObservation | None = None


class MediaObservation(BaseModel):
    kind: Literal["image", "video", "audio"]
    filename: str = Field(max_length=255)
    language: Literal["en", "hi"] = "en"
    original_text: str = Field(default="", max_length=20000)
    segments: list[Segment] = Field(default_factory=list, max_length=150)
    frames: list[Frame] = Field(default_factory=list, max_length=6)
    warnings: list[str] = Field(default_factory=list, max_length=10)
    visual_consistency: VisualObservation | None = None
    provenance: ProvenanceObservation | None = None


class ReaderCitation(BaseModel):
    quote: str = Field(min_length=1, max_length=700)
    source_url: str | None = Field(default=None, max_length=2048)
    publisher: str | None = Field(default=None, max_length=200)


class ReaderFinding(BaseModel):
    claim: str = Field(min_length=8, max_length=300)
    assessment: Literal["SUPPORTED", "REFUTED", "MIXED", "INSUFFICIENT_EVIDENCE"]
    assessment_author: Literal["reader"] = "reader"
    citations: list[ReaderCitation] = Field(default_factory=list, max_length=8)
    explanation: str = Field(default="", max_length=1000)

    @model_validator(mode="after")
    def require_citations(self):
        if self.assessment != "INSUFFICIENT_EVIDENCE" and not self.citations:
            raise ValueError("Reader support/refutation annotations require quoted citations.")
        return self


class TextV2Input(BaseModel):
    text: str = Field(min_length=10, max_length=20000)
    model: Literal["logistic", "svm"] = "logistic"
    reader_findings: list[ReaderFinding] = Field(default_factory=list, max_length=6)


class MultimodalInput(TextV2Input):
    media: MediaObservation


class VerifyInput(BaseModel):
    claim: str = Field(min_length=8, max_length=300)
    urls: list[Annotated[str, Field(min_length=8, max_length=2048)]] = Field(default_factory=list, max_length=2)
    source_text: str | None = Field(default=None, min_length=40, max_length=20000)


class AnalysisReport(BaseModel):
    schema_version: int = 2
    content_classification: dict
    claim_verification: dict
    modalities: dict
    conflicting_signals: list[str]
    uncertainty: list[str]
    human_review_recommended: bool = True
    observations_origin: str
    prediction_scope: str = "article_text"
    media_classification: dict | None = None


class AnalysisEnvelope(BaseModel):
    analysis: dict
    report: AnalysisReport
    source: dict | None = None


class VerificationResponse(BaseModel):
    claim: str
    assessment: Literal["SUPPORTED", "REFUTED", "MIXED", "INSUFFICIENT_EVIDENCE"]
    confidence: float | None = None
    evidence: list[dict]
    warnings: list[str]
    explanation: str
