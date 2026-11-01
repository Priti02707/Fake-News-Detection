# Verity 2.0 upgrade

This release extends the existing Next.js/FastAPI/Vercel application with evidence investigation and measured robustness. Existing classifier weights and their original evaluation are preserved.

## Implemented

- Transparent candidate-claim prioritization across the full article, with exact offsets and selection reasons.
- Recent-news discovery via GDELT, optional English/Hindi published fact-check search, and reader-provided sources.
- SSRF-protected public-source extraction reused for evidence; source dates and exact quoted passage offsets are retained.
- A BM25 passage shortlist, optional browser-local MiniLM semantic ranking and DeBERTa English textual-entailment assistance.
- A citation notebook with reader-authored support/contradiction/insufficiency notes, explicit conflicts, source-domain counts, and JSON export.
- OCR line rectangles, clickable video timestamps, and media traces in article exports and opt-in history.
- Experimental Hindi OCR and speech extraction; English classifiers continue to abstain on Hindi-script input.
- Experimental CLIP comparison between two image descriptions, without authenticity or factual-truth labels.
- Local C2PA inspection with manifest export, explicit signer-trust limits, and remote manifest retrieval disabled.
- Reproducible grouped/stratified/temporal experiments, a sampled semantic-cluster diagnostic, per-class/AUC/calibration/interval metrics, stress tests, and a dashboard of measured results.
- Configurable PyTorch transformer training and local inference, with measured DistilBERT/RoBERTa/DeBERTa tiny pilots and an explicit no-promotion registry.
- Browser video keyframes/frame OCR, typed v2 reports, transparent fusion, stronger language detection, request IDs/guards, and browser print-to-PDF.

## Measured evaluation

See `models/robustness.json` for partitions, source checksums, metrics, protocols, and limitations. Temporal holdout accuracy is 99.45% for Logistic Regression and 99.80% for SVM; macro F1 is 0.9905 and 0.9965. Models are retrained per experiment; this is historical within-corpus evidence and does not establish current-news or independent-publisher accuracy.

## Boundaries and remaining research

- The original CSVs lack authenticated publisher IDs; a publisher-disjoint evaluation requires appropriate new metadata.
- Independent-corpus evaluation, trained Hindi veracity classification, and domain-level evidence/image accuracy require separate licensed datasets, label definitions, and experiments.
- Deepfake detection remains a separate research module requiring suitable models, compute, and cross-dataset evaluation. No detector is simulated in the interface.
- Google published fact-check search requires the owner's server-side API key. GDELT source leads and manual evidence review work independently of that key; third-party search services can be unavailable.
- Persistent shared evidence indexing (for example PostgreSQL/pgvector) is not provisioned. The bounded notebook needs no account/database and retains the project's session/browser privacy model.
- Functional checks of real downloaded models establish that the application runs; they are not claims of benchmark accuracy or verified truth.

## Validation

The final, detailed release record is [docs/RELEASE_REPORT.md](docs/RELEASE_REPORT.md).

Run `python -m pytest tests -q`, `npm run build`, `npm run typecheck`, and regular Playwright tests. Set `RESEARCH_INTEGRATION=1 MEDIA_INTEGRATION=1` for real model downloads, signed/unsigned C2PA fixtures, image/audio extraction, and Hindi OCR checks. Final deployment status and check results are reported with the release.

## Primary references

- [AVeriTeC](https://github.com/MichSchli/AVeriTeC): evidence-based verification and evaluation design.
- [Sentence Transformers](https://www.sbert.net/examples/sentence_transformer/applications/retrieve_rerank/README.html): semantic retrieval and reranking.
- [NLI DeBERTa ONNX](https://huggingface.co/Xenova/nli-deberta-v3-xsmall): optional textual-entailment model.
- [CLIP ONNX](https://huggingface.co/Xenova/clip-vit-base-patch32): experimental visual-description comparison.
- [Content Credentials SDK](https://github.com/contentauth/c2pa-js): embedded C2PA inspection.
- [GDELT DOC API](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/): recent-news discovery.
