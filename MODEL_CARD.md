# Fake News Detection model card

## Intended use

Educational exploration of English news article classification and transparent feature contributions. The model predicts labels learned from historical article examples, not factual truth. It is not suitable for automated moderation or consequential decisions.

## Data and protocol

The repository's original two 5,000-row sample CSVs were recovered from Git commit `afe1eb8`. Full dataset provenance and redistribution terms were absent from the original commits. Only derived model parameters and aggregate metrics are deployed.

Normalized article content is deduplicated; content carrying conflicting labels is removed; short/empty normalized content is excluded. Normalized headline groups remain together. A seeded group split yields 5,977 training, 1,994 calibration, and 1,993 test articles. This guards exact article/headline leakage but does not guarantee semantic deduplication, publisher independence, or temporal independence.

TF-IDF uses a 20,000-feature cap, English stopwords, unigrams and bigrams, `min_df=2`, `max_df=0.9`, raw counts, smoothed IDF and L2 normalization. Numbers are preserved. The vectorizer is fitted on training only. Logistic Regression and Linear SVM use balanced class weights. Each model's raw score is sigmoid-calibrated with a logistic regression on validation only. Test metrics are computed after training and calibration. Full machine-readable provenance and library versions are in `models/metrics.json`.

## Output and uncertainty

0=fake-labeled article, 1=real-labeled article. These are dataset labels. The website returns Uncertain when confidence is below 0.8, the input has fewer than 40 words, less than 8% of unique candidate features are known, the models disagree, or the text has more than 10% non-Latin letters. These thresholds are conservative product heuristics, not an optimized or independently validated uncertainty detector. Language identification now uses seeded langdetect in addition to the script check. It is fallible; Latin-script non-English inputs can be rejected, but this is not a language-identification benchmark. V2 short-input handling returns no article-model score.

Unsupported scripts receive no displayed probability or word explanations. Other uncertain results can show a score to explain model behavior, with a clear statement that it is not factual certainty. Out-of-distribution English can still produce overconfident errors.

## Explanations

Contributions are normalized TF-IDF values multiplied by the underlying linear coefficients. Positive values move the raw score toward real-labeled examples; negative values move it toward fake-labeled examples. Intercepts and calibration also affect the displayed probability. The top 12 contributions are returned; the UI displays the top 8 and highlights matching individual words. A highlighted word is not evidence that a claim is true or false. Bigram contributions are shown in the chart and can span stopwords because the vectorizer removes stopwords before generating bigrams.

## Evaluation limitations

Both models score highly on the held-out historical samples. These scores must not be compared directly to results from other datasets or experimental splits. Near-duplicates and recognizable publisher/writing-style cues may remain. Scores are not established for Hindi, emerging news, screenshots, short claims, satire, opinion, or deliberately adversarial rewrites. Future work should test publisher and temporal holdouts and independent datasets before broad claims of accuracy.

Fact-check retrieval does not alter the classifier's result. Candidate sentences remain unverified. Related publisher reviews may address a different claim, date, or context; the UI preserves source attribution and original ratings.

## Additional evaluation and assistance modules

`scripts/evaluate.py` produces `models/robustness.json` without replacing deployed weights. It reproduces the original grouped experiment and separately retrains on disjoint chronological partitions, removing repeated headline groups from later partitions. It reports calibration/reliability, balanced accuracy, headline stress tests, selected source-cue removal, and train-fitted lexical cosine overlap screening. A cosine threshold of 0.85 is declared before measurement; this does not detect all semantic duplication. Publisher and independent-corpus evaluation remain unavailable in this report.

Candidate selection is a heuristic across the input, not a trained claim-spotting model. BM25 retrieves exact passages with source offsets. Optional MiniLM semantic ranking and DeBERTa NLI run in the browser; textual entailment/contradiction suggestions do not authenticate sources or establish factual truth. The NLI 0.8 score and 0.2 margin cutoffs are unvalidated product heuristics. Only reader annotations contribute to the notebook's explicitly reader-authored assessment. These outputs do not modify article-classifier predictions.

The separate local research API exposes an existing benchmark checkpoint without promoting it. It checks model/tokenizer artifact hashes against the local evaluation manifest, requires safetensors and local-only loading, and returns no production confidence. Its sigmoid research score represents dataset label 1, not factual truth; calibration fitted on a small pilot is not production validation. English inputs under 40 words and unsupported languages abstain before model loading. Inputs are truncated to the checkpoint's recorded token limit (96 in the current DistilBERT pilot). Transformer attribution is not implemented; production linear explanations remain available. Real saved-checkpoint inference tests establish execution only.

Publication-date notes and within-source passage deduplication aid evidence review. The 365-day window is a declared interface heuristic and never determines a claim verdict. Dates supplied by publishers can be inaccurate; missing or future dates require inspection, and historical evidence can remain relevant.

Connected media review adds no trained factual classifier. A relative CLIP margin of 0.2 can flag a reader-supplied caption for investigation. English timeline heuristics compare nearby speech/frame text using lexical overlap and negation; they can be wrong on quotations, complex negation, OCR/ASR errors and ordinary narration. They are not evaluated NLI or contradiction detectors. Automatic source gathering leaves passages unreviewed; reader-authored findings and experimental NLI remain separate. No production accuracy, calibration or model-promotion claim changes.

CLIP compares two English image descriptions only; relative scores are not authenticity or truth probabilities. C2PA inspection reports embedded metadata and SDK validation state without establishing signer trust; absence is inconclusive. Hindi OCR/multilingual ASR are experimental extraction capabilities, not a Hindi misinformation classifier. OCR bounding boxes and ASR timestamps refer to the original extraction and can be inaccurate. No population-level OCR/ASR, evidence-relation, Hindi, image-context, or deepfake accuracy is established by integration tests.
