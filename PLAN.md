# Fake News Detection — implementation plan

Project owner and primary developer: **Priti Kumari**, [Priti02707](https://github.com/Priti02707). Existing repository: [Fake-News-Detection](https://github.com/Priti02707/Fake-News-Detection). The requested name supersedes the proposed VERITAS AI/Veritas-AI identity; use the existing repository and Vercel project.

## Scope and starting state

Follow the supplied master prompt in order. This release completes Phase 0 planning and the explicitly requested project rename. Existing functionality is audited rather than counted as newly implemented. Later phases require their own acceptance evidence. [Reference review](docs/REFERENCE_COMPARISON.md) precedes substantive implementation. [Phase gates](PHASES.md) define remaining work.

Smallest useful MVP: paste an English article, obtain a real calibrated writing-pattern prediction with contributions/abstention, select a claim, inspect exact source passages, record reader assessments, and export a report. It already exists. Headlines abstain because the bundled models were evaluated on full articles. International search is available when providers respond; an index match never becomes an automatic verdict.

## Architecture decisions

1. Retain Next.js/React/TypeScript/Tailwind/Lucide and the deployed FastAPI application. Do not migrate to Vite merely to match a suggested stack. Add UI libraries only when needed; Recharts, Query and shadcn are candidates, not installed capabilities.
2. Keep inference, retrieval, reader annotations and future automated evidence assessment separate. Quotes require source provenance and offsets; unsupported factual conclusions return insufficient evidence.
3. Keep image/audio/video bytes browser-local for the current bounded workflow. Future long videos use isolated FFmpeg workers, object storage and durable queued jobs with cancellation/status persistence, not Vercel process memory.
4. Use PostgreSQL plus migrations for future production users/history; SQLite may support local development. Authentication needs verified sessions, per-record ownership, account deletion and explicit retention. No database or account service is currently configured.
5. Keep trained transformer/fusion/forensic models in optional offline research. Promote only after licensed data review, leakage-safe evaluation, calibration, latency/memory measurement, reproducible manifests and comparison with baseline.
6. Preserve Vercel project `priti-09/verity-news` and the primary public URL. Its internal slug and existing browser storage keys remain compatible with earlier deployments; displayed project identity becomes Fake News Detection.

## Target product and dependencies

| Area | Existing | Next deliverable |
| --- | --- | --- |
| Navigation | Dashboard, analyze tabs, world search, notebook, history, evaluation, about | Dedicated landing/report/evidence/settings views with honest readiness labels |
| Text | English LR/SVM, heuristic claims, language checks, contributions | Named entities/atomic claims, separate Hindi evaluation, transformer comparison |
| Media | OCR, speech, sampled frame timestamps, optional CLIP/C2PA | Explicit metadata/context support; evaluated paired models before authenticity claims |
| Evidence | Exact BM25 passages, dates, reader assessments, optional NLI, provider search | Configured grounded agent with allowlisted citations, source-independence review and evaluated verdicts |
| Persistence | Opt-in browser history, deletion, JSON/print PDF | Authenticated, owner-scoped durable records and report retention |
| Operations | Tests, GitHub CI, Docker definitions, Vercel | Shared rate limits, observability and separate worker/inference service when justified |

## Apple Silicon dependency plan

Observed environment: macOS arm64, Python 3.12.7 and Node 26.10.0; CI uses Node 22. Use Python 3.12 and a supported Node 22+ release. `requirements.txt` remains lightweight; `requirements-dev.txt` adds Python evaluation/test tools. `requirements-ml.txt` and `requirements-tracking.txt` are optional local installations; never add their heavy imports to Vercel startup. CPU is the reproducible research default. MPS needs an explicit benchmark and operator configuration; availability is not equivalent to model compatibility. No new dependency is needed for Phase 0 or branding.

Future candidates, only as their phase requires: SQLAlchemy/migrations and PostgreSQL driver (auth/history); FFmpeg/OpenCV and durable queue client (long videos); a configured HTTP LLM/search provider (evidence); multilingual encoders/NER (separately evaluated NLP). Document licenses and lock versions when adding each package. [Data policy](docs/DATASETS.md) governs all downloads.

## Exact Phase 1 setup

From this existing checkout (do not reinitialize Git or create another repository):

```sh
npm ci
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python -m pytest tests -q
npm run test:unit
npm run build
npm run typecheck
# terminal one
.venv/bin/python -m uvicorn backend.main:app --reload --port 8000
# terminal two
npm run dev
```

Open http://localhost:3000 and http://localhost:8000/api/docs. Store optional server secrets only in the backend environment, never client bundles. Browser models require network access on first use. To run browser checks after both servers are ready: `npx playwright test --workers=1` (install Chromium with `npx playwright install chromium` only when missing).

## Repository and release procedure

The owner repository already exists and `origin` points to it, so no repository creation is required. For a fresh clone: `git clone https://github.com/Priti02707/Fake-News-Detection.git`. Create a feature branch, commit with authentic configured authorship, push, open a PR to `main`, and wait for CI before merging. Do not force-push. Release tags must identify tested source. Run `npx --yes vercel --prod --scope priti-09 --yes` from the linked checkout for an authorized production release, then verify public health, capabilities and relevant browser flows. Keep credentials out of command output and Git.

## Risks and prerequisites

Google Fact Check has no production key configured as of the last live check. GDELT was temporarily unavailable. No LLM evidence provider, managed database, auth issuer, durable media worker or reviewed Hindi/forensic corpus is provisioned. A missing dependency must remain unavailable. An open-source license requires the owner's explicit choice; no LICENSE is added automatically. Screenshots and test records must state their actual capture/execution context.
