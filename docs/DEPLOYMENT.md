# Deployment and operations

The existing project is `priti-09/verity-news`, with production alias https://fake-news-detection-priti.vercel.app and source repository https://github.com/Priti02707/Fake-News-Detection. The former address https://verity-news-sable.vercel.app remains attached for compatibility. Preserve this existing project; both domains track future production deployments.

Vercel builds Next.js and routes `/api/*` to the FastAPI Python entry point. Only lightweight runtime requirements are installed. Browser recognition models download lazily on request. Local PyTorch checkpoints, datasets, research reports/configuration and caches are excluded from function packaging. Google Fact Check uses the optional server-side `GOOGLE_FACT_CHECK_API_KEY`; no paid API is required for text/OCR/transcription/manual evidence review.

```sh
npm ci
python3.12 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
# another terminal
npm run dev
```

Use `requirements-ml.txt` only for local research. Model files are cached under ignored `.cache/` and `.artifacts/`. CPU works; CUDA is optional. Do not install this research environment into the Vercel Python function.

The Docker Compose configuration builds separate CPU web/API containers. `API_ORIGIN` is a trusted server/build-time setting used for the Docker proxy; it is not accepted from user URLs. Docker verification requires a functioning Docker installation and is reported separately from npm/Python checks.

```sh
docker compose up --build
# publish the verified existing Vercel project
npx vercel --prod --scope priti-09
```

After deployment, check `/api/health`, `/api/v2/capabilities`, `/api/v2/models/metrics`, article analysis, citations and real opt-in media flows. A successful build alone does not establish that remote model assets load in production. News-provider outages, missing Google keys and device memory limits must remain visible unavailable states.

Docker Compose configuration was validated locally. A container image build/run was not verified because the installed Docker daemon was stopped (its socket was absent). This does not block the separately verified Vercel deployment.

## Separate local research service

After installing `requirements-ml.txt` and producing a benchmark checkpoint:

```sh
VERITY_RESEARCH_MODEL_DIR=.artifacts/distilbert-base-uncased \
  .venv/bin/python -m uvicorn backend.research_api:app --host 127.0.0.1 --port 8010 --workers 1
```

Visit `/api/research/docs` on that port. Health exposes `configured` and `model_loaded`; configuration alone does not prove checkpoint validity. The first eligible request verifies and loads the local checkpoint. No model is downloaded. Restart the process to switch checkpoints. Keep this unauthenticated research service bound to localhost; no public dedicated inference host, authentication layer or GPU service is provisioned. The existing Vercel app and Docker web/API configuration continue to use production linear models. This local research service is not deployed through `api/index.py`.

## Production browser verification

`playwright.config.ts` accepts `PLAYWRIGHT_BASE_URL`; its default remains the local server. After deploying, run `PLAYWRIGHT_BASE_URL=https://fake-news-detection-priti.vercel.app npm run test:e2e -- --workers=1`. This checks the actual public site, including new media/evidence flows. Optional model integrations remain opt-in.

The manually triggered **Production smoke checks** GitHub workflow runs public desktop/mobile workflows plus actual image OCR and original local-video frame/timeline checks from a separate network. Trigger with `gh workflow run production-smoke.yml --ref main`. Add `-f research_models=true` to also execute actual CLIP, NLI and Whisper checks with large model downloads. These are functional checks, not domain accuracy benchmarks. It needs no new application secrets and does not upload raw user media. A successful Vercel build, authenticated health check and public browser smoke run are distinct results; report any failed/unavailable stage explicitly.
