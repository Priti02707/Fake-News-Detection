# Website screenshots

These PNG files were captured from the actual local production build on **2026-11-02**, after the Fake News Detection rename.
They are browser screenshots, not generated images or design mockups.

- Source: http://127.0.0.1:3100 with the current FastAPI backend at port 8100. Public deployment: https://fake-news-detection-priti.vercel.app/
- Browser: Chromium through the installed Playwright package.
- Viewport: 1440 × 1000 pixels, device scale factor 1, light theme.
- Source: Phase 0 renamed interface on `feature/project-phase-zero`; screenshots and their source changes are committed together. Build command: `API_ORIGIN=http://127.0.0.1:8100 npm run build`. No claim of a new model experiment is made.
- No intercepted API responses, replacement workers, or fabricated results were used.

| File | Visible workflow | How it was captured |
| --- | --- | --- |
| [detect-verify.png](detect-verify.png) | Combined assessment selector and action | Later `feature/detect-and-verify` local production build, 1440 × 1100, dark theme. Load the built-in practice article, select the combined assessment mode, capture the actual input card. No result is simulated or shown. |
| [dashboard.png](dashboard.png) | Dashboard and available input options | Open the site and wait for model availability to load. |
| [text-analysis.png](text-analysis.png) | Real prediction response and analysis coverage | Select **Try an example**, then **Analyze article**, wait for results, and scroll to the result section. |
| [developer.png](developer.png) | Priti Kumari owner/developer card and GitHub link | Open **How it works** and scroll the developer card into view. |
| [model-performance.png](model-performance.png) | Recorded metrics, dataset splits, and confusion matrices | Open **Model evaluation** and scroll to the top. |

The built-in example is invented practice text, not a verified news article.
Its screenshot records an actual model response; the displayed score is not factual certainty or overall project accuracy.
Performance values originate from the repository's [recorded metrics](../../models/metrics.json).

To refresh screenshots, repeat these steps on the actual local build or deployed site and record which was used with the same viewport.
Review every image before replacing it, and update this capture record if the deployment or content changes.
