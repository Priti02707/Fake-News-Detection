"""Optional local CPU service. Not imported by the Vercel API entry point."""
import os
import re
import threading
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from backend.challenger import TransformerChallenger
from backend.language import identify_language
from backend.main import limit_body
from backend.security import logger


class ResearchInput(BaseModel):
    text: str = Field(min_length=10, max_length=20000)


class ResearchResult(BaseModel):
    verdict: Literal["uncertain"] = "uncertain"
    confidence: None = None
    research_score: float | None = Field(default=None, ge=0, le=1)
    model: str | None = None
    revision: str | None = None
    max_tokens: int | None = None
    language: dict
    deployment_status: Literal["research_only"] = "research_only"
    calibration_validated_for_production: Literal[False] = False
    warning: str


class ResearchService:
    def __init__(self, directory=None, loader=TransformerChallenger):
        self.directory = directory
        self.loader = loader
        self.model = None
        self.slot = threading.Lock()

    def predict(self, text):
        if not self.directory:
            raise HTTPException(503, "Research inference is unconfigured. Set VERITY_RESEARCH_MODEL_DIR in the separate local service.")
        language = identify_language(text)
        if len(re.findall(r"\b\w+\b", text)) < 40 or language["code"] != "en":
            return ResearchResult(language=language, warning="Research article inference requires at least 40 words of English context. No model score was produced.")
        if not self.slot.acquire(blocking=False):
            raise HTTPException(503, "Research inference is busy. Try again shortly.", headers={"Retry-After": "5"})
        try:
            if self.model is None:
                self.model = self.loader(Path(self.directory))
            return ResearchResult(**self.model.predict(text), language=language)
        except Exception as error:
            # Do not expose local paths, checkpoint contents or input text.
            logger.warning("Research inference unavailable: %s", type(error).__name__)
            raise HTTPException(503, "The local research checkpoint or optional dependencies are unavailable or invalid. Check the local configuration and artifact manifest.") from error
        finally:
            self.slot.release()


def create_app(service=None):
    application = FastAPI(title="Verity local research API", version="1.0.0", docs_url="/api/research/docs")
    application.middleware("http")(limit_body)
    service = service if service is not None else ResearchService(os.getenv("VERITY_RESEARCH_MODEL_DIR"))

    @application.get("/api/research/health")
    def health():
        return {"status": "ok", "configured": bool(service.directory), "model_loaded": service.model is not None, "deployment_status": "research_only", "automatic_downloads": False}

    @application.post("/api/research/analyze/text", response_model=ResearchResult)
    def analyze(payload: ResearchInput):
        return service.predict(payload.text)

    return application


app = create_app()
