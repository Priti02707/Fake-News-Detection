# Verity · Explainable News Analysis

A news-analysis website by **Priti**. Paste an English article, inspect the words influencing a machine-learning prediction, and search related published fact-checks.

Built from the original Fake News Detection notebook, with a Next.js interface, FastAPI backend, reproducible training, and portable model parameters that require no TensorFlow or scikit-learn in production.

> Predictions describe learned writing patterns. They do not establish factual truth. Evidence search is a separate step, and extracted sentences remain unverified.

## Features

- Responsive editorial interface with keyboard-accessible navigation.
- English text analysis with Logistic Regression and calibrated Linear SVM.
- Signed word/phrase contributions and highlighted words in context.
- **Uncertain** results for short text, low scores, low vocabulary overlap, unsupported scripts, or classifier disagreement.
- Public article extraction with a review step before analysis.
- Related published fact-checks through the optional Google Fact Check Tools API, preserving publisher ratings and source links.
- Evaluation dashboard, confusion matrices, and downloadable JSON reports.
- Opt-in browser-local history, limited to 30 analyses; no article database.
- API tests and desktop/mobile browser checks.

## Run locally

Use Node.js 22+ and Python 3.12. The trained model is included; training is optional.

```sh
npm ci
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Start the API in one terminal:

```sh
.venv/bin/python -m uvicorn backend.main:app --reload --port 8000
```

Start the website in another:

```sh
npm run dev
```

Open **http://localhost:3000**. Next.js proxies `/api/*` to FastAPI locally. API docs: **http://localhost:8000/api/docs**.

### Optional fact-check search

Enable the Google Fact Check Tools API in a Google Cloud project. Export `GOOGLE_FACT_CHECK_API_KEY` in the API process environment before starting Uvicorn. In Vercel, add it to the project's environment variables and redeploy. Never use a `NEXT_PUBLIC_` variable for this key.

`.env.example` documents the name; Python does not automatically load Next.js `.env.local` files. Without a key, analysis and extraction still work. The evidence panel reports that search is unconfigured and provides a manual Google Fact Check Explorer link. This is distinct from a successful search returning **No matching fact-check found**.

## Evaluation

The website uses newly trained models from the repository samples, rather than the older notebook's results.

| Measure | Logistic Regression | Linear SVM |
|---|---:|---:|
| Test accuracy | 99.05% | 99.90% |
| Macro F1 | 0.9905 | 0.9990 |
| Brier score, lower is better | 0.0062 | 0.0013 |
| Test errors | 19 | 2 |

**10,000 input rows → 9,964 usable articles**, split into 5,977 training, 1,994 calibration, and 1,993 test articles. Normalized content duplicates and conflicting labels are removed. Normalized headline groups stay in one partition. TF-IDF fits training only; sigmoid calibration fits validation only. Seeds, CSV checksums, library versions, and metrics are in [models/metrics.json](models/metrics.json).

These are historical, in-domain results. There is no publisher or temporal holdout; source cues and semantic near-duplicates can inflate scores. Hindi, current events, short claims, and broad real-world generalization have not been evaluated. Reported batch scoring excludes text processing and network time. See [MODEL_CARD.md](MODEL_CARD.md).

## Reproduce training

```sh
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python scripts/restore_data.py
.venv/bin/python scripts/train.py
```

The restore script reads the original sample CSVs from commit `afe1eb8`; it does not recommit article content. A shallow checkout may need `git fetch --unshallow` first. For your own CSVs with `title` and `text` columns:

```sh
.venv/bin/python scripts/train.py --fake /path/Fake.csv --real /path/True.csv
```

Training fails on malformed rows. See [data/README.md](data/README.md) for provenance limitations. Export compares both portable models against sparse-matrix calculations on 25 held-out articles.

The preserved [original notebook](Fake_News_Detection_Complete.ipynb) contains older Colab experiments on a larger dataset. Its LSTM/CNN code does not establish completed deep-learning results and is not used by the website.

## Verify

```sh
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest tests/test_api.py -q
npm run build
npm run typecheck
npx playwright install chromium
```

With both local development servers running:

```sh
npm run test:e2e
```

GitHub Actions runs API, build, type, and browser checks. Browser tests use the unconfigured-key state; leave `GOOGLE_FACT_CHECK_API_KEY` unset for that suite.

## Deploy to Vercel

The root `vercel.json` builds Next.js and routes `/api/*` to `api/index.py`, which exports FastAPI. Training libraries and datasets are excluded from deployment.

```sh
npx vercel --scope priti-09
npx vercel --prod --scope priti-09
```

Verify `/api/health` after deployment. Add the optional Google API key in Vercel settings. Apply provider API-key restrictions, quotas, and Vercel rate limits before high-traffic sharing. No paid service or database is required by the app itself; provider usage limits and terms still apply.

## Structure

```text
app/                    Next.js website and responsive styles
api/index.py            Vercel Python entry point
backend/main.py         API endpoints and uncertainty policy
backend/inference.py    Portable TF-IDF and calibrated linear inference
backend/extraction.py   Public URL extraction with pinned connections
models/                 Parameters and measured evaluation
scripts/                Dataset recovery and training
tests/                  API and browser tests
```

## Data handling and limitations

Article text is processed without database storage. Optional history stays in the browser. Hosting providers can retain standard request metadata. Fact-check search sends the chosen query to Google. URL extraction checks resolved addresses and redirect targets, pins connections to public IPs, verifies HTTPS certificates, and limits response size. It cannot bypass paywalls or publisher restrictions.

Planned research: evaluated Hindi support, screenshot OCR, DistilBERT comparisons, and claim-to-evidence verification. These are not implemented capabilities in this release.
