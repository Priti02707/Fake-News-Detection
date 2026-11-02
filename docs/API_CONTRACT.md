# Fake News Detection — current API contract

FastAPI OpenAPI is the authoritative request/response schema: local `/api/docs` and `/api/openapi.json`. Implementation: `backend/schemas.py`, `backend/main.py`, `backend/v2.py`. The proposed `/api/v1` design is not implemented; existing clients use the following routes.

| Route | Input / result |
| --- | --- |
| `GET /api/health` | Service status, model-file readiness, fact-check configuration; configuration does not prove provider connectivity |
| `GET /api/v2/capabilities` | Actual execution boundaries and unavailable models |
| `GET /api/metrics`, `/api/evaluation`, `/api/v2/models/metrics` | Recorded model, robustness and registry metadata |
| `POST /api/analyze` | `text` 40–20,000 characters, at least 8 words; `model`: `logistic` or `svm`. Writing-pattern result with uncertainty, features and heuristic claims |
| `POST /api/v2/analyze/text` | `text` 10–20,000 chars, optional model and reader findings; `AnalysisEnvelope` separates classification and verification. Short inputs abstain |
| `POST /api/v2/assess` | `text` 10–20,000 chars; `mode`: `detect`, `verify`, `detect_verify` (default). Optional `claim`, `source_url`, `source_text`, `notes`, review `language` (`all`/`en`/`hi`) and reviewed `media`. Returns nullable `analysis`/`report`, independent `classification_error`, and nullable source `verification` with discovery, exact evidence and explicit availability. Verification-only never calls the classifier; detection-only never searches. |
| `POST /api/extract` | Public `url` 8–2,048 chars; extracted source text/metadata, SSRF protections |
| `POST /api/v2/analyze/url` | Same URL input; source, analysis and structured report |
| `POST /api/v2/analyze/image`, `/video`, `/audio` | Reviewed `text`, model, and bounded client-supplied `media` observation. Accepts JSON metadata, not raw uploads; full-media classification is not evaluated |
| `POST /api/claims` | Same input as legacy analysis; heuristic candidate statements, not verified claims |
| `POST /api/evidence` | `query` 8–300 chars plus exactly one public `url` or pasted `text` 40–20,000 chars; exact passages/offsets and date review context |
| `POST /api/v2/verify/claims` | `claim` 8–300 chars; up to 2 URLs and optional source text; retrieved evidence, warnings and `INSUFFICIENT_EVIDENCE`, never an automatic supported/refuted conclusion |
| `POST /api/fact-check`, `/api/coverage` | `query` 8–300 chars, optional supported `language`; published reviews or recent news leads, with `matches`, `no_matches`, `unavailable` |
| `POST /api/world-news` | Trimmed `query` 8–300 chars, language default `all`, publisher country default `all`, timespan `1d`/`7d`/`1month`/`3months`; independent `news` and `fact_checks` states, timestamp, filters and insufficient-evidence assessment |

World-news language options: `all`, `en`, `hi`, `es`, `fr`, `pt`, `de`, `ar`, `bn`, `zh`, `ja`, `ru`, `uk`, `id`, `tr`. Country options are a bounded allowlist in `WorldNewsInput`; `all` searches globally. Language filters do not translate the query. Country/time filters apply only to news; fact-checks retain publisher ratings and all dates/countries.

## Errors and privacy

Validation/unsafe URLs: 422; oversized bodies: 413; rate limit: 429 with Retry-After; extraction/provider failure: 502/503 where applicable; missing model/metrics: 503. Discovery provider outages are typed `unavailable` results so another provider's successful leads survive. Legacy POST body maximum is 100 KB; v2 maximum 500 KB. Responses carry no-store/nosniff and request IDs. Reports must keep reader-authored assessments distinct from automated results.

There are no account/session, durable analysis-record or long-running-job endpoints in production. Browser history is local opt-in storage, not authenticated server history. Those routes require Phase 3/7/9 infrastructure and ownership checks before advertisement. External source bodies are untrusted quotations and cannot issue execution instructions. No fabricated `/api/v1/analyses/{id}` or status route is exposed.
