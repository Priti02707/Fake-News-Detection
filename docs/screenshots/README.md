# Actual application screenshots

Captured on **2026-11-02** from the local production build of `feature/multimodal-workspace-introduction`, at http://127.0.0.1:3200 with the current FastAPI backend on port 8100. Public application: https://fake-news-detection-priti.vercel.app/; alternate production address: https://verity-news-sable.vercel.app/.

- Chromium through installed Playwright; desktop viewport **1440 × 1320**, device scale factor 1; the app's default dark theme.
- Build: `API_ORIGIN=http://127.0.0.1:8100 npm run build`, followed by the matching production frontend/backend servers.
- These are real screenshots, not generated mockups. No API responses, model workers or inference results were intercepted or replaced.
- Source and screenshots are committed together. The built-in article is invented practice text, not a verified news report. Model output and recorded dataset metrics are not factual certainty or universal accuracy.

| File | Actual workflow |
| --- | --- |
| [dashboard.png](dashboard.png) | Multimodal workspace introduction, actual model-readiness indicator and empty two-column workspace with combined assessment mode selected; action disabled until input is supplied. |
| [detect-verify.png](detect-verify.png) | The actual input card, text import, source-notes disclosure, mode selector and action. |
| [workspace-report.png](workspace-report.png) | Built-in practice text sent to the real classifier; the report is manually saved with a Needs closer review reader annotation. |
| [text-analysis.png](text-analysis.png) | Full actual model result, coverage/uncertainty, signed feature contributions and highlighted words. |
| [model-performance.png](model-performance.png) | Recorded model metrics and confusion matrices read from the API; no new benchmark was executed. |
| [developer.png](developer.png) | Actual Methodology/About page with Priti Kumari attribution and GitHub profile link. |

Desktop and 390 × 844 mobile previews were separately inspected. Images reflect the final interface source in this release. Future refreshes should record the source/build, viewport, theme and whether local or deployed capture was used.
