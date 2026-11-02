# Automatic assessment — actual validation

Date: 2026-11-02. Base: `c3e17b006707ee27e9405b0413c1d87533d43d4b`.
Local branch: `feature/automatic-evidence-assessment`.

## Implementation scope

New: server-only `.env` loading and sanitized connection CLI; checksum-bound automatic model policy; nested training-only group-CV selector; original-article provenance; reviewed publisher-domain policy; bounded multi-claim retrieval; optional Groq grounded assessment with validated quotations; relevance/coverage scores; evidence-led UI; compatible saved reports and exports.

Existing retained: Next.js/FastAPI architecture, portable TF-IDF LR/SVM artifacts, SSRF/IP-pinned source fetcher, reader-authored annotations, browser-local media, history, model evaluation and deployment identity. These are not claimed as newly implemented.

## Executed checks

| Check | Actual result |
| --- | --- |
| `.venv/bin/python -m pytest tests -q` | 117 passed, 2 optional research skips, 1 Starlette/httpx deprecation warning |
| `.venv/bin/python -m pytest tests/test_grounded_assessment.py -q` after final probe/test adjustment | 21 passed |
| `npm run test:unit` | 14 passed |
| `npm run build` | Passed; final build repeated after UI changes |
| `npm run typecheck` | Passed; final check repeated after build |
| Full desktop/mobile Playwright suite using temporary Chromium | 54 passed, 2 failed assertions, 16 opt-in integration skips. Both failures expected two displays of a claim; the added per-claim report correctly displayed three. Assertions updated. |
| Relevant Playwright rerun (`app`, `assessment`, `workspace`, desktop and mobile) | 22 passed, including both corrected cases; new automatic selection/cited assessment/save/restore/export flow and responsive width checks passed |
| `git diff --check` | Passed |
| `.env` protection | `git check-ignore .env` confirmed ignored; mode 600; Docker context excludes `.env*` |
| Real ASGI health/assessment smoke | Health HTTP 200; verify-only pasted evidence HTTP 200, one claim, one exact passage, insufficient evidence; no invented factual confidence |
| Connection CLI | Groq not configured; Google Fact Check not configured; GDELT HTTP 503 |

The full browser suite was not rerun in its entirety after correcting the two assertions; the affected app/assessment/workspace screens were rerun. Other earlier checks remained unchanged. Sixteen opt-in browser tests require external OCR/speech/semantic/CLIP/C2PA resources and were not enabled. Two Python research integration tests also remained skipped. No live credentialed Groq or Google assessment, production deployment, external claim-accuracy benchmark or original-data retraining was performed.

## Environment and recovery details

Python 3.12, Node 24.22.1, project Next.js 16.4.3. Standard `npm ci` failed while fetching an optional `onnxruntime-node` native asset through the environment proxy. `npm ci --ignore-scripts --no-audit --no-fund` succeeded; existing web configuration excludes `onnxruntime-node` from its bundle. Python requirements installed successfully. SOCKS support was installed only in the local test environment for its proxy; no new production dependency was added.

The normal Playwright Chromium download returned invalid/truncated archives. A temporary `@sparticuz/chromium` 153 runtime was installed outside the repository and exercised through an ignored local Playwright config, removing its single-process flag to support repeated browser contexts. This package/config is not an application dependency or deliverable. Standard CI still uses the normal Playwright Chromium installation. Local test servers ran together in one process environment with explicit loopback hostname. The alternative Chromium differs from the normal Playwright-pinned browser, so standard CI remains a release gate.

## Test meaning and limits

Synthetic fixtures exercise publisher-domain spoofing and altered text, year/person relevance, exact/syndicated passage deduplication including negation, missing keys, bounded fetch counts, provenance integration, unsupported citations, conflicting aggregation, Groq HTTP/JSON validation, sanitized connection probes, nonexecuting environment loading and leakage-safe selection machinery. They do not certify real-world semantic judgment, allegation handling or factual accuracy. Groq output is always provisional. Exact quote validity does not prove that a model interpreted the quote correctly.

The 45/100 relevance threshold and publisher scores are documented project heuristics/policy choices, not empirically calibrated probabilities. Only exact duplicate text/families are identified; paraphrased syndication and source dependence need review. Historical article classifiers remain supplementary. The original CSVs are absent, so the shipped model manifest explicitly retains the prior baseline pending CV; there is no claimed new production winner.

## Repository and release status

GitHub `create_branch` through the Priti connection returned HTTP 403: `Resource not accessible by integration`. No remote branch, PR, CI run, merge or deployment was created. The tested changes are provided as a local feature-branch commit plus a patch that applies to the base commit. Repository write access is required to push/open the planned PR. Wait for standard CI before considering a merge or publication.
