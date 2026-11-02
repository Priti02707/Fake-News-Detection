# Fake News Detection user guide

Start with the [project README](../README.md) for installation, the live demo, and model results.
This guide covers input limits, optional tools, privacy, and common problems.

## Choose an input

| Tab | Accepted input | Limits |
| --- | --- | --- |
| Paste text | Typed/pasted text, dragged text, or one UTF-8 `.txt`/`.md` file | 20,000 characters; file up to 1 MB |
| Article URL | One public HTTP(S) article link | URL up to 2,048 characters; publisher restrictions apply |
| Image | PNG, JPEG, WebP | 10 MB and 20 megapixels |
| Audio | WAV, MP3, M4A, OGG, FLAC, WebM | 20 MB and 60 seconds; browser codec support required |
| Video | MP4, WebM, MOV | 25 MB and 60 seconds; browser codec support required |

Use the matching tab before dropping a file or link. Each media drop accepts one file.
Invalid text drops preserve the existing editor contents. File selection and typing are keyboard-accessible alternatives.

## Review extracted words

1. Choose the extraction language. English is the supported classification language; Hindi extraction is experimental.
2. Select **Extract image text**, **Transcribe audio**, or **Transcribe video**.
3. Correct recognition errors, especially names, dates, numbers, and negation.
4. Select **Classify reviewed words**, or use **Use reviewed text** to move the words to the article editor.
5. Inspect the prediction, influential terms, and uncertainty notes before exporting a report.

Full articles provide more context than headlines. The v2 classifier abstains on inputs shorter than 40 word tokens.
A fake-like or real-like result describes learned article patterns; it is not an independently verified news verdict.

For images, retained OCR regions show where extracted lines appeared. For video, transcript timestamps can seek playback.
**Inspect video frames** reads on-screen text from up to six sampled frames. Sampling can miss scenes and subtitles.
The report separates reviewed-text classification from an uncertain, unevaluated full-media result.

## Optional evidence review

The **Investigate claims** workspace helps collect sources for a specific statement.
Candidate statements are selected heuristically and remain unverified.

- Discover news leads through GDELT, enter a public source URL, or paste source text.
- Retrieve exact passages with source links, publication metadata, and retrieval timestamps.
- Optionally compare passages using browser-local semantic ranking and English textual entailment.
- Record your own support/contradiction assessment and export the evidence notebook before leaving.

Reader-authored findings and experimental model suggestions remain separate from article predictions.
No matching fact-check does not mean a claim is true. Search results do not authenticate publishers or source independence.

Google Fact Check search requires `GOOGLE_FACT_CHECK_API_KEY` in the backend environment.
See [.env.example](../.env.example) and [deployment instructions](DEPLOYMENT.md).
Do not use a `NEXT_PUBLIC_` variable for this server-side key.
The Python backend does not automatically load Next.js `.env.local` files.

## Experimental media tools

- **CLIP comparison:** compares two reader-provided image descriptions. Relative similarity cannot establish the event, date, location, authenticity, or truth.
- **Hindi extraction:** offers Hindi/English OCR and speech extraction. Hindi and mixed-language misinformation classification has not been independently evaluated.
- **Content Credentials:** inspects embedded C2PA metadata. Signer trust is not established; missing credentials do not imply manipulation.
- **Evidence AI:** semantic relevance and textual-entailment suggestions assist reading; they do not independently verify claims.

Transformer challengers and learned fusion are local research tools, not production classifier choices.
See [models](MODELS.md), [multimodal pipelines](MULTIMODAL_PIPELINES.md), and [implementation status](IMPLEMENTATION_STATUS.md).

## Reports, history, and privacy

**Download report** exports JSON; **Print / save PDF** uses the browser print dialog.
Reports retain reviewed text and available extraction metadata, not the raw media file.
Optional browser-local history stores up to 30 analyses. Original media previews are unavailable after a history restore.
Evidence notebooks are kept in page memory; export before reloading or changing the claim/file.

Raw media is processed in browser workers. Models download from third-party hosts, which receive normal connection metadata.
Reviewed words and bounded observation metadata are sent to the backend only when analysis is requested.
Evidence searches and source retrieval send the chosen query, URL, or pasted source text to the server and relevant providers.
Article bodies are not stored in an application database. Hosting providers may retain standard request metadata.
See [security and data handling](SECURITY.md).

## Troubleshooting

| Problem | What to try |
| --- | --- |
| Recognition is slow or a download fails | Keep the tab open, check internet access, try a smaller file, or cancel and paste the words manually. |
| The browser cannot decode a clip | Re-export video as MP4 with AAC or WebM with Opus; try WAV/MP3 for standalone audio. |
| No speech is found | Check that the clip contains audible speech. Silent video can still use frame inspection. |
| An article cannot be extracted | Paste the article text; the app does not bypass paywalls or publisher blocks. |
| The prediction is Uncertain | Supply a fuller English article and review the listed reasons. Do not force an unsupported score. |
| Fact-check search is unavailable | Configure the optional backend key or use manual source review. |
| Local API requests fail | Run both servers from the repository root and check backend health at `http://localhost:8000/api/health`. |

## Further technical documentation

- [Architecture and API organization](ARCHITECTURE.md)
- [Model training and local research inference](MODELS.md)
- [Dataset provenance and limitations](DATASETS.md)
- [Evaluation and verification commands](EVALUATION.md)
- [Deployment, Docker, and production checks](DEPLOYMENT.md)
- [Fusion dataset contract and commands](ADVANCED_CLASSIFICATION_AUDIT.md)
- [Original dataset recovery and training inputs](../data/README.md)
- [Model card](../MODEL_CARD.md)
