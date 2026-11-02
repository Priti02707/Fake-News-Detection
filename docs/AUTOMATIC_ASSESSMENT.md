# Automatic model selection and grounded claim assessment

Approved scope: light refactor of the existing application. Existing article classifiers, browser media tools, source retrieval, reader annotations, saved reports and deployment identity are retained. New work makes selection automatic, adds original-source provenance and publisher policy, and provides an optional Groq assessment over fetched evidence.

## Local server secrets and connection checks

From the repository root:

```sh
cp .env.example .env
chmod 600 .env
# Open .env in your editor and fill GROQ_API_KEY and GOOGLE_FACT_CHECK_API_KEY.
.venv/bin/python scripts/check_connections.py
.venv/bin/python -m uvicorn backend.main:app --reload --port 8000
npm run dev
```

A blank, mode-600 `.env` has already been created in the development checkout. Do not overwrite it once populated. It is excluded by Git and Docker build context. The example contains variable names only. Python loads allowlisted settings from the root `.env` without shell evaluation; deployment environment variables take precedence. Restart the backend after edits. Docker Compose passes `.env` at runtime to the API service; the file is not copied into either image. On Vercel/separate hosting set the same server variables using the host's environment settings, not frontend public variables.

- `GROQ_API_KEY`: grounded assessor. Default configurable `GROQ_MODEL=llama-3.3-70b-versatile`. JSON object mode plus server-side Pydantic/citation validation, not provider-enforced JSON schema. [Groq JSON output documentation](https://console.groq.com/docs/structured-outputs).
- `GOOGLE_FACT_CHECK_API_KEY`: published claim reviews. Enable the Fact Check Tools API for the key's Google project. Review matching remains necessary.
- GDELT: no API key. Outages and empty results remain explicit.

Never place secrets in `NEXT_PUBLIC_*`, commit them, upload a populated env file, or paste them into reports. The CLI emits only connection statuses. Health exposes configuration booleans, not values. Key presence is not proof a provider works. Local HTTP proxy support may require an environment-specific SOCKS dependency; it is not an application dependency.

When enabled, the backend sends selected claims and bounded fetched passages to Groq, and selected claims to search providers. Raw media remains browser-local. Reader notes are not sent as instructions to the assessor. Disable/remove the relevant key to leave a provider unavailable.

## Automatic article-model selection

Normal UI no longer has an LR/SVM dropdown. `auto` is the API default; explicit legacy/research requests remain compatible. The selected model comes from `models/selection.json`, checked against the classifier artifact SHA-256. A missing/invalid manifest retains the historical Logistic Regression baseline with an explicit fallback reason. Per-article confidence never picks a model.

The shipped manifest is **baseline_pending_cv**, not a claimed new winner. Original `data/Fake.csv` and `data/True.csv` are absent here; no historical test metrics were used to choose a model and no dataset was downloaded without a rights review.

With authorized local CSVs, run `python scripts/train.py --fake PATH --real PATH`. The training pipeline now performs three-fold nested headline-group cross-validation **inside the training partition only**, with a separate fit/calibration split per fold and fresh vocabularies. Selection ranks macro-F1, Brier score and minimum class recall at 0.001 precision, with a recorded scoring-latency guard and stable-ID tie-breaker. It then refits the release candidates and calibrates on the original separate calibration partition; the final test set is evaluated once. The release manifest includes fold results, protocol, dataset hashes, reason and artifact hash. `scripts/evaluate.py` remains an evaluation tool, not a selector.

A synthetic pipeline test exercises the split/selection machinery; it is not a scientific benchmark. Historical article-label metrics do not measure current-news factuality. Short and unsupported-language inputs bypass article inference and can still use evidence assessment.

## Provenance and publisher policy

The frontend passes `article_url` separately from `source_url`/`evidence_urls` (supporting evidence). The server refetches the original through existing SSRF/IP-pinning/redirect protections, retains requested/final URL and publication date, and compares normalized full text exactly. An edited paste, mentioned publisher name, failed fetch or HTTP/lookalike domain receives no inherited credibility.

`configs/source-credibility.json` starts with Reuters and Associated Press domains and explicitly permitted `www` hosts. Both have published [Reuters standards](https://reutersagency.com/about/standards-values/) / [AP principles](https://www.ap.org/about/news-values-and-principles/). Their 90/100 score is a documented **project editorial-policy index**, not measured accuracy or a probability of truth. Unknown domains remain unassessed. Registry policy version, rationale, standards link and review date are retained. Extend this small registry only after documenting the publisher/domain review.

## Claims, relevance and citations

- Up to three heuristic claim candidates, or one reader-selected claim. The result is scoped to these claims, not every assertion in the article.
- Up to four fetched documents total, including an original-source fetch when present. Search concurrency, original reads, source reads, Groq calls and a 24-second shared investigation deadline are bounded. The frontend keeps its 28-second timeout. Search results are ranked and news/fact-check leads interleaved before retrieval; submitted evidence is prioritized. One primary claim is still displayed for backward compatibility.
- Original-source reporting is excluded as independent corroboration. Pasted evidence stays visible but cannot supply authenticated factual citations.
- Exact passages are ranked by token coverage, multiword entity overlap and year consistency. Version `2026-11-02.1`, threshold 45/100; explicit conflicting years cap relevance at 20. These conservative, uncalibrated heuristics can miss paraphrases. Groq additionally reviews semantic/event/entity/place/date/number/attribution match and supports/refutes stance. There is no separate deployed embedding model.
- Identical passages across outlets are deduplicated before assessment. General syndicated paraphrases and source independence still need reader review; multiple links are not treated as independent votes.
- Only fetched passages go to the assessor, with IDs, source URLs and dates. Search snippets and publisher ratings remain leads with their original wording; they do not automatically establish a verdict.
- Schema validation rejects invented IDs, nonverbatim quotes, semantic mismatches, inconsistent stances and decisive conclusions without citations. A mixed conclusion requires both stances. Prompt-injection resistance includes data-only boundaries and citation checks, not a guarantee that an LLM cannot make semantic mistakes.
- Missing keys, HTTP failures, rate limits, malformed responses or deadline expiry preserve partial results and abstain. No factual confidence percentage is fabricated.

Reports separate publisher credibility, heuristic evidence relevance, percentage of selected claims with usable passages, factual assessment and supplementary writing-pattern confidence. Relevance/coverage remain available even when Groq is unconfigured. Aggregate support/refutation requires all selected claims to have the same decisive assessment; conflicting claims become mixed, and unresolved claims prevent an article-wide support/refutation label.

`/api/v2/assess` and `/api/v2/verify/claims` use the same service. Reports include per-claim exact citations, source URLs, assessor availability, versioned scores and provisional labels. New saved-report fields are optional so older records restore. New fields/URLs are validated on restoration. Exported JSON retains the full evidence assessment. Browser reader annotations remain reader-authored and distinct.

## Validation and remaining gates

See `docs/AUTOMATIC_ASSESSMENT_VALIDATION.md` for actual commands/results. Synthetic fixtures validate contracts, spoof/alteration handling, missing credentials, citation rejection, contradictory aggregation, fetch limits and selection splits. They **do not** measure real-world support/refutation accuracy. No independently reviewed real-news claim benchmark or live credentialed Groq/Google run has been completed. Keep results provisional and require source review. Future calibration of relevance thresholds, paraphrase retrieval, allegation handling and LLM error rates needs reviewed claim cases.

This refactor does not certify the broader original project phases, provision a new deployment, or promote a newly trained model.
