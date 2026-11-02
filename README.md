# Verity AI 2.0 · Explainable Multimodal Evidence Verification

A misinformation investigation platform by **Priti**. Inspect article-model explanations, investigate image–news mismatches, follow video speech and frame text on a timeline, and gather cited evidence with explicit uncertainty.

**Live website:** https://verity-news-sable.vercel.app · [Vercel project](https://vercel.com/priti-09/verity-news)

Built from the original Fake News Detection notebook, with a Next.js interface, FastAPI backend, reproducible training, and portable model parameters that require no TensorFlow or scikit-learn in production.

> Predictions describe learned writing patterns. They do not establish factual truth. Evidence search is a separate step, and extracted sentences remain unverified.

## Features

- **Image–news mismatch review:** compare a headline/caption with an alternative image description, flag relative visual mismatch for investigation, and gather cited source passages. Image identity, event date and location remain unverified until supported by evidence.
- **Video investigation timeline:** chronological speech and sampled frame/subtitle observations, clickable playback locations, nearby wording/negation review flags, and timestamp-linked evidence notebooks.
- **Explainable fact verification:** bounded source discovery/retrieval, verbatim quotations, publication dates, optional NLI suggestions, reader-authored support/contradiction findings, and contextual JSON/print-to-PDF reports.
- Responsive editorial interface with keyboard-accessible navigation.
- English text analysis with Logistic Regression and calibrated Linear SVM.
- Signed word/phrase contributions and highlighted words in context.
- **Uncertain** results for short text, low scores, low vocabulary overlap, unsupported scripts, or classifier disagreement.
- Public article extraction with a review step before analysis.
- Browser-local English OCR for news screenshots/photos and speech transcription for short video clips, with editable review before analysis.
- Related published fact-checks through the optional Google Fact Check Tools API, preserving publisher ratings and source links.
- Evaluation dashboard, confusion matrices, and downloadable JSON reports.
- Opt-in browser-local history, limited to 30 analyses; no article database.
- API tests and desktop/mobile browser checks.
- Evidence notebooks with verbatim passages, source dates, citations, reader assessments, and downloadable investigation reports.
- Optional browser-local semantic retrieval and English textual-entailment assistance; model suggestions remain separate from reader assessments.
- Recent-news source discovery through GDELT, alongside optional published fact-check search.
- OCR line regions, video transcript timestamps, experimental Hindi extraction, image-description comparison, and embedded C2PA inspection.
- Grouped/stratified/temporal holdouts, calibration and bootstrap/Wilson intervals, headline/style stress tests, and sampled semantic/lexical overlap diagnostics.
- Configurable local DistilBERT/RoBERTa/DeBERTa research training, matched small pilots, artifact checksums, and an explicit no-automatic-promotion registry.
- Typed v2 report APIs, modality coverage summaries, and browser Print / save PDF alongside JSON exports.

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

## Analyze images and videos

Select **Image** or **Video** beside Paste text. Choose a file, select **Extract image text** or **Transcribe video**, correct the extracted words, then select **Use reviewed text**. This fills the article editor; **Analyze article** starts the existing text analysis.

| Input | Limits | What is extracted |
|---|---|---|
| PNG, JPEG, WebP | 10 MB, 20 megapixels | English written text with Tesseract.js |
| MP4, WebM, MOV | 25 MB, 60 seconds | English speech with Whisper tiny.en through Transformers.js |

Files remain in the browser. MIME/signature checks are supplemented by real decoding. Recognition runs in a worker and can be cancelled; only one expensive model job runs per page. First use downloads recognition software/models from jsDelivr, Hugging Face, and their delivery hosts; these hosts receive normal connection metadata. The browser may cache models for later use. No additional API key is required. Only reviewed text is sent to the analysis server when requested.

Video playback and audio decoding depend on the browser's codec support. MP4 with AAC audio or WebM with Opus audio are recommended. Clear audio, readable screenshots, an internet connection for model downloads, and sufficient device memory are required. First-time video transcription can take several minutes, particularly on phones. Text is limited to 20,000 characters; longer extractions are shortened with a notice. A stalled extraction stops after ten minutes.

These features analyze extracted words, not visual authenticity, deepfakes, video scenes, or factual truth. Recognition can omit or invent words, especially with noise, silence, or unsupported languages. Review the transcript and its context. The existing evaluation scores apply to the article classifiers, not OCR or speech accuracy.

References: [Tesseract.js](https://github.com/naptha/tesseract.js), [Transformers.js browser workers](https://huggingface.co/docs/transformers.js/en/tutorials/next), [Whisper tiny.en ONNX model](https://huggingface.co/onnx-community/whisper-tiny.en).

## Investigate a claim

Open **Investigate claims** in the navigation, or select **Open evidence notebook** after analyzing an article. Candidate statements are ranked across the input using transparent heuristics (numbers/dates, reported events, named entities, and opinion cues), not a trained check-worthiness model. Edit one claim before gathering evidence.

1. Discover recent news using topic keywords, inspect a related published fact-check, enter a public source URL, or paste source text.
2. Retrieve verbatim source passages. The server uses BM25 lexical relevance and returns original character offsets, source-reported publication dates, retrieval timestamps, and the final fetched URL. Pasted text is explicitly unauthenticated and has no invented citation URL.
3. Optionally select **Compare evidence with AI**. This downloads `Xenova/all-MiniLM-L6-v2` for semantic ranking and `Xenova/nli-deberta-v3-xsmall` for English textual entailment, then runs them in a browser worker. Up to four passages are compared; weak or neutral results remain inconclusive. The 0.8 score and 0.2 margin thresholds are product heuristics, not validated fact-verification thresholds.
4. Record your own assessment and reasoning for each passage, then export **verity-investigation.json**. The report includes exact passages, citations, retrieval dates, model suggestions/probabilities, and reader annotations. Changing the claim clears its previous notebook. The notebook is held in page memory; export before reloading or leaving.

An entailment model compares statements; it does not authenticate the publisher, establish factual truth, or verify that a source is independent. Similarity measures relevance, not credibility. Conflicting reader assessments are shown explicitly. Neither retrieval nor reader annotations change the article classifier's score.

Repeated passages within a source are deduplicated before shortlisting. Citation cards and JSON exports include publication-date review notes for unknown, invalid, future or older dates. A one-year review window is a context aid: old evidence can be appropriate for historical claims, and recent evidence can still be unreliable. Publication metadata remains source-reported.

GDELT recent-news search needs no API key, sends the chosen query to GDELT, and searches a recent coverage window. News leads are not fact-check verdicts. Provider outages and no matches are separate states. The optional Google Fact Check API still requires `GOOGLE_FACT_CHECK_API_KEY`; manual evidence review remains available without it.

### Connected image and video investigations

1. Select **Image** and upload a photo. Open **Explore image context**, enter its associated headline/caption under **Description to investigate**, and supply an alternative visual description. Optional CLIP comparison reports a potential relative mismatch when the alternative's score exceeds the caption's by at least 0.2. This is a review heuristic, not a validated misinformation detector. A match cannot establish the event, date or location.
2. Select **Investigate this image claim** to search GDELT and retrieve passages from up to two distinct source URLs through the existing SSRF-protected server. Only selected words are sent; the image stays local. Sources are leads until reviewed, and separate domains do not prove independence. If providers fail or no passages match, the notebook remains insufficient evidence and accepts manual sources.
3. For **Video**, transcribe speech and/or inspect frames. The **Video investigation timeline** combines timestamped speech, sampled frame text and optional visual comparisons. Nearby topic differences or aligned wording with different negation are marked for review. These English lexical heuristics do not establish contradictions or deepfakes. Sampling spans the full clip, up to six frames, with scene-change selection; intermediate scenes and subtitles may be missed.
4. Select **Investigate this moment with sources** to gather evidence for that excerpt. Correct the selected claim, inspect citations and dates, optionally run English NLI, and record your assessment. Image/video notebooks export the original media context or timestamp with citations and reader findings. **Download timeline JSON** exports the chronological observations separately. **Print evidence / save PDF** uses the browser print dialog.

Claim edits clear prior citations and cancel active retrieval. Changing files clears the associated notebook; export before moving to article analysis. Saved text-analysis reports also derive timeline observations from retained media metadata, but raw original files/previews are not persisted. The deployed classifier and model metrics are unchanged. Deepfake detection remains an optional research extension without a simulated detector.

## Media context and provenance

Image extraction now retains OCR line rectangles. Select a line to highlight its image region. Video transcripts retain approximate timestamps; select one to seek in the original clip. **Inspect video frames** samples bounded representative keyframes with simple scene-change selection and runs OCR on their on-screen text. Sampling interval and frame count are configurable, up to six frames and 4K input dimensions. Sampled scenes can be missed; no complete visual or authenticity verification is claimed. Silent clips can use frame inspection independently. Each keyframe also offers optional description comparison. Choose **Add on-screen text to review** to include frame text in the editable analysis input. These traces describe the original extraction, even after text corrections, and are included in article-report exports and opt-in saved history. JSON reports do not contain the media file itself.

Choose **Hindi + English (experimental)** for Hindi image OCR or Hindi speech transcription (`onnx-community/whisper-tiny`). Recognition quality has not been independently measured for Hindi. The article classifier remains English-only and abstains on Hindi-script text. Hindi evidence can be reviewed manually and searched in published fact-checks; English entailment assistance is disabled for Hindi-script claims.

**Explore image context** compares two reader-provided English descriptions with `Xenova/clip-vit-base-patch32`. Scores express relative visual match between those descriptions only. They cannot establish the image's event, date, location, authenticity, or factual truth. Reverse-image search is a manual external step, with its own provider's data handling.

**Inspect Content Credentials** uses `@contentauth/c2pa-web` to inspect embedded C2PA manifests locally. The reader downloads from jsDelivr. Remote-manifest fetching is disabled and signer trust is not established; the report preserves the SDK's validation state. Missing credentials do not mean fake; present credentials do not verify news claims. Credential reports can be downloaded separately. No media is uploaded by these local tools.

All optional model tools have cancel controls/time limits or bounded reader timeouts. Downloads can take several minutes and may fail on devices with insufficient memory. Source retrieval/search sends the chosen query, URL, or pasted text to the application server; external search providers receive queries only when their search is requested.

## Evaluation

The website uses newly trained models from the repository samples, rather than the older notebook's results.

| Measure | Logistic Regression | Linear SVM |
|---|---:|---:|
| Test accuracy | 99.05% | 99.90% |
| Macro F1 | 0.9905 | 0.9990 |
| Brier score, lower is better | 0.0062 | 0.0013 |
| Test errors | 19 | 2 |

**10,000 input rows → 9,964 usable articles**, split into 5,977 training, 1,994 calibration, and 1,993 test articles. Normalized content duplicates and conflicting labels are removed. Normalized headline groups stay in one partition. TF-IDF fits training only; sigmoid calibration fits validation only. Seeds, CSV checksums, library versions, and metrics are in [models/metrics.json](models/metrics.json).

These are historical, in-domain results. The original grouped experiment has no publisher or temporal holdout; source cues and semantic near-duplicates can inflate scores. Hindi, current events, short claims, and broad real-world generalization have not been evaluated. Reported batch scoring excludes text processing and network time. See [MODEL_CARD.md](MODEL_CARD.md).

Research/training and API contracts are documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/MODELS.md](docs/MODELS.md), and [docs/EVALUATION.md](docs/EVALUATION.md).

The original table above describes the original grouped split. Additional, separately retrained experiments are in [models/robustness.json](models/robustness.json) and the website's Model evaluation view. Additional stratified and sampled semantic experiments and their per-class/interval metrics are in the same report:

| Temporal holdout | Logistic Regression | Linear SVM |
|---|---:|---:|
| Accuracy | 99.45% | 99.80% |
| Macro F1 | 0.9905 | 0.9965 |

The temporal experiment has 5,962 training, 1,987 calibration, and 2,014 test examples. Date boundaries are disjoint; repeated normalized headline groups are removed from later partitions. Each experiment fits its own vectorizer/model/calibration without replacing production weights. The report also includes balanced accuracy, Brier score, calibration bins/ECE, headline-only stress tests, removal of four selected source cues, and results after excluding test examples with training cosine similarity ≥ 0.85. This is lexical screening, not semantic deduplication or an independent-corpus test.

Publisher holdout remains unmeasured because the original CSVs lack authenticated publisher IDs. Independent-corpus accuracy and domain accuracy of the experimental evidence/image models remain unmeasured. Functional browser checks do not establish research accuracy.

Reproduce these additional experiments without changing deployed models:

```sh
.venv/bin/python scripts/evaluate.py
```

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
.venv/bin/python -m pytest tests -q
npm run build
npm run typecheck
npm run test:unit
npx playwright install chromium
```

With both local development servers running:

```sh
npm run test:e2e
```

To additionally run real OCR and video transcription checks (downloads recognition models and a public-domain speech sample):

```sh
MEDIA_INTEGRATION=1 npm run test:e2e -- --project=desktop tests/browser/media.spec.ts
```

Real optional evidence models, image-context comparison, C2PA fixtures, Hindi OCR, and media checks:

```sh
RESEARCH_INTEGRATION=1 MEDIA_INTEGRATION=1 npm run test:e2e
```

These optional checks download third-party recognition models and public test fixtures. Regular CI runs deterministic API/UI checks and skips those network-heavy integration cases.

GitHub Actions runs API, build, type, and browser checks. Browser tests use the unconfigured-key state; leave `GOOGLE_FACT_CHECK_API_KEY` unset for that suite.

After production deployment, the **Production smoke checks** GitHub workflow verifies the public site from a cloud runner, including desktop/mobile workflows and real image/video-frame OCR. It can be triggered with `gh workflow run production-smoke.yml --ref main`. Locally, set `PLAYWRIGHT_BASE_URL` to test a deployed URL instead of localhost. See [the multimodal release record](docs/MULTIMODAL_RELEASE.md) for executed results and unavailable checks.

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

### Where is the frontend?

The **`app/` folder is the frontend**. It uses Next.js, React and TypeScript.

| File | What to edit |
|---|---|
| [`app/page.tsx`](app/page.tsx) | Main page, navigation, input tabs, results and history |
| [`app/globals.css`](app/globals.css) | Colors, spacing, responsive layouts and print styles |
| [`app/layout.tsx`](app/layout.tsx) | Root page layout and website metadata |
| [`app/media-input.tsx`](app/media-input.tsx) | Image/video uploads, previews and extraction review |
| [`app/image-context.tsx`](app/image-context.tsx) | Image–caption comparison and investigation controls |
| [`app/video-timeline.tsx`](app/video-timeline.tsx) | Timestamped video investigation interface |
| [`app/investigation.tsx`](app/investigation.tsx) | Evidence search, citations, reader findings and exports |

Files ending in `.worker.ts` run model tasks in browser workers. `backend/` contains the Python API. `.next/` contains generated build output; edit the source files in `app/` to change the website. Run `npm run dev` to open the frontend at http://localhost:3000; start FastAPI as described above for API-backed workflows.

## Data handling and limitations

Article text is processed without database storage. Optional history stays in the browser. Hosting providers can retain standard request metadata. Fact-check search sends the chosen query to Google. URL extraction checks resolved addresses and redirect targets, pins connections to public IPs, verifies HTTPS certificates, and limits response size. It cannot bypass paywalls or publisher restrictions.

Planned research: independently evaluated Hindi classifiers, domain-validated claim verification, independent-publisher/corpus evaluation, and deepfake detection. No deepfake detector or factual-truth probability is claimed by this release. Full independent-source transformer benchmarking is not completed; the recorded 64/32/32 pilots are execution checks, not production selection. See [UPGRADE_REPORT.md](UPGRADE_REPORT.md).

Resume description: **Verity AI 2.0 — Explainable Multimodal Misinformation Detection and Evidence Verification Platform**. Describe the implemented evidence/review workflows and measured tests alongside the limitations; no independently validated multimodal factual accuracy or deepfake performance is claimed.


## API v2 and local research

Legacy routes remain available. The frontend uses `/api/v2/analyze/text`, `/analyze/image`, and `/analyze/video` for structured reports. Image/video inputs contain reviewed browser extraction metadata; raw files are not uploaded. Reports distinguish text scores, client-reported modality observations, reader findings, unverified evidence, and unavailable authenticity analysis. V2 short inputs receive no full-article model score. `/api/v2/verify/claims` returns actual retrieved passages or explicit insufficient evidence; `/api/v2/models/metrics` includes registry metadata and measured evaluation. `/api/v2/capabilities` documents deployment limits. Serverless instance memory is not advertised as a durable media-job queue.

Optional CPU/CUDA research, excluded from Vercel:

```sh
.venv/bin/pip install -r requirements-ml.txt
.venv/bin/python scripts/audit_data.py --semantic --limit 500
.venv/bin/python scripts/benchmark_transformers.py --config configs/transformer-pilots.json
.venv/bin/python scripts/build_registry.py
```

The larger `configs/transformer-benchmark.json` supports full fine-tuning configurations. Large checkpoints stay under ignored `.artifacts/` and `.cache/`. The deployed linear models are preserved. Public evidence does not become a calibrated truth probability through fusion.

After creating a local checkpoint, optionally start the separate research API:

```sh
VERITY_RESEARCH_MODEL_DIR=.artifacts/distilbert-base-uncased \
  .venv/bin/python -m uvicorn backend.research_api:app --host 127.0.0.1 --port 8010 --workers 1
```

Its docs are at **http://127.0.0.1:8010/api/research/docs**. `POST /api/research/analyze/text` accepts `{"text":"an English article of at least 40 words"}`. It lazily verifies and loads local safetensors, with one model request at a time and no downloads. Unconfigured, invalid and busy states return 503; short or non-English inputs receive no score. Outputs always remain `research_only`, with `confidence: null`; the research score describes a dataset label, never factual certainty. Existing tiny pilots remain unsuitable for promotion. This service is separate from the website's production classifier selector and Vercel API.

Run the actual saved-checkpoint integration check separately:

```sh
VERITY_TEST_RESEARCH_MODEL_DIR=.artifacts/distilbert-base-uncased \
  .venv/bin/python -m pytest tests/test_research.py -q -k actual_local
```

See [baseline audit](docs/BASELINE_AUDIT.md), [dataset contracts](docs/DATASETS.md), [multimodal pipelines](docs/MULTIMODAL_PIPELINES.md), [security](docs/SECURITY.md), [deployment and Docker](docs/DEPLOYMENT.md), and [implementation record](docs/CHANGELOG_IMPLEMENTATION.md). Docker Compose configuration is provided; image-build verification depends on a running Docker daemon.
