# Architecture

```mermaid
flowchart LR
  Inputs[Article / URL / image / video] --> Review[Browser preview and editable review]
  Inputs --> Workers[Bounded browser workers]
  Workers --> OCR[OCR regions / speech timestamps / frame text]
  Workers --> Optional[Optional CLIP / NLI / C2PA]
  OCR --> Review
  Review --> API[FastAPI legacy and v2 routes]
  API --> Linear[Preserved calibrated LR / SVM]
  API --> Retrieval[Public-source extraction and passage retrieval]
  Retrieval --> Notebook[Citation notebook and reader assessment]
  Linear --> Report[Structured report with modality coverage]
  Notebook --> Exports[Investigation JSON / browser print to PDF]
  Report --> Exports
```

Next.js retains the established interface and browser-local media privacy model. Heavy recognition models are lazy, pinned downloads in workers, not Vercel Python dependencies. API startup never downloads transformer checkpoints. Files remain on the device; reviewed words and bounded observation metadata go to FastAPI only for requested analysis.

`backend/inference.py` owns production scoring; `investigation.py` owns candidate selection and passage ranking; `fusion.py` owns explicit rule-based coverage/uncertainty; `schemas.py` defines request contracts; `v2.py` assembles versioned routes. Registry metadata is read without importing PyTorch. Local research inference lives in `backend/challenger.py` and is not imported by the API.

`backend/research_api.py` is an optional, separately launched local FastAPI application. It wraps `TransformerChallenger` with typed input/output, lazy single-slot inference, English/length abstention, safe load errors and existing body/rate/request-ID middleware. Health reports configuration and loading separately. The normal Vercel entry point does not import this service or PyTorch; no research route is added to production. Checkpoint paths come exclusively from operator configuration. Model/tokenizer hashes are verified against the local evaluation report before heavy-library loading.

Evidence retrieval deduplicates repeated passages within each source while retaining exact original offsets. Source-reported publication dates produce a structured `date_context` review note in both legacy evidence and v2 verification responses. The notebook displays and exports those notes without changing the reader's assessment or NLI suggestions.

The connected media workflow uses `frontend/multimodal.ts` for explicit visual-review and timeline rules, `frontend/video-timeline.tsx` for chronological observations/seeking/exports, and the existing `ImageContext`, `MediaInput` and `Investigation` components. Selecting a media claim initiates one cancellable discovery request and at most two sequential source retrievals, then preserves quotations as unreviewed. Model workers remain optional and local. Media-origin metadata, original comparison inputs and timestamps are included in investigation exports; edited claims clear prior citations. React-generated IDs keep multiple mounted notebooks/frame controls distinct.

Browser media workers are asynchronous jobs with cancellation, bounded file/duration/frame limits, and processing timeouts. A server job broker is not introduced for the current 60-second browser workflow. There is no persistent `/jobs` service advertised; `/api/v2/capabilities` reports this explicitly. A future server GPU/media service would require a real broker and storage rather than pretending Vercel instance memory is durable job storage.

API v2 image/video routes accept reviewed extraction metadata, not raw media uploads. The server labels the observation origin as client-submitted and does not authenticate those observations. The legacy `/api/analyze`, `/extract`, `/fact-check`, `/metrics`, and `/health` contracts remain available. See `MULTIMODAL_PIPELINES.md` for execution details.

## Frontend source organization

`frontend/` contains React interface modules, CSS, media processing helpers and browser workers. `app/page.tsx` re-exports the main interface; `app/layout.tsx` keeps the Next.js root layout and loads `frontend/globals.css`. The icon remains a framework file under `app/`. Root Node dependencies/configuration, `/api/*` routes, Docker commands and Vercel project settings are preserved. Run all npm commands from the repository root. This separation moves source files without duplicating the interface or creating a second website.
