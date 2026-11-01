# Deployment and operations

The existing project is `priti-09/verity-news`, with production alias https://verity-news-sable.vercel.app and source repository https://github.com/Priti02707/Fake-News-Detection. Preserve this project and alias rather than creating another site.

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
