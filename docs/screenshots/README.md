# Website screenshots

These PNG files were captured directly from the public production site on **2026-11-02**.
They are browser screenshots, not generated images or design mockups.

- Source: https://fake-news-detection-priti.vercel.app/
- Browser: Chromium through the installed Playwright package.
- Viewport: 1440 × 1000 pixels, device scale factor 1, light theme.
- Production source revision at capture: `736b4dd`.
- No intercepted API responses, replacement workers, or fabricated results were used.

| File | Visible workflow | How it was captured |
| --- | --- | --- |
| [dashboard.png](dashboard.png) | Dashboard and available input options | Open the site and wait for model availability to load. |
| [text-analysis.png](text-analysis.png) | Real prediction response and analysis coverage | Select **Try an example**, then **Analyze article**, wait for results, and scroll to the result section. |
| [model-performance.png](model-performance.png) | Recorded metrics, dataset splits, and confusion matrices | Open **Model evaluation** and scroll to the top. |

The built-in example is invented practice text, not a verified news article.
Its screenshot records an actual model response; the displayed score is not factual certainty or overall project accuracy.
Performance values originate from the repository's [recorded metrics](../../models/metrics.json).

To refresh screenshots, repeat these steps on the deployed site with the same viewport.
Review every image before replacing it, and update this capture record if the deployment or content changes.
