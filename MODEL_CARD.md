# Verity model card

## Intended use

Educational exploration of English news article classification and transparent feature contributions. The model predicts labels learned from historical article examples, not factual truth. It is not suitable for automated moderation or consequential decisions.

## Data and protocol

The repository's original two 5,000-row sample CSVs were recovered from Git commit `afe1eb8`. Full dataset provenance and redistribution terms were absent from the original commits. Only derived model parameters and aggregate metrics are deployed.

Normalized article content is deduplicated; content carrying conflicting labels is removed; short/empty normalized content is excluded. Normalized headline groups remain together. A seeded group split yields 5,977 training, 1,994 calibration, and 1,993 test articles. This guards exact article/headline leakage but does not guarantee semantic deduplication, publisher independence, or temporal independence.

TF-IDF uses a 20,000-feature cap, English stopwords, unigrams and bigrams, `min_df=2`, `max_df=0.9`, raw counts, smoothed IDF and L2 normalization. Numbers are preserved. The vectorizer is fitted on training only. Logistic Regression and Linear SVM use balanced class weights. Each model's raw score is sigmoid-calibrated with a logistic regression on validation only. Test metrics are computed after training and calibration. Full machine-readable provenance and library versions are in `models/metrics.json`.

## Output and uncertainty

0=fake-labeled article, 1=real-labeled article. These are dataset labels. The website returns Uncertain when confidence is below 0.8, the input has fewer than 40 words, less than 8% of unique candidate features are known, the models disagree, or the text has more than 10% non-Latin letters. These thresholds are conservative product heuristics, not an optimized or independently validated uncertainty detector. Script detection does not detect every non-English language; Latin-script languages may still be unsupported.

Unsupported scripts receive no displayed probability or word explanations. Other uncertain results can show a score to explain model behavior, with a clear statement that it is not factual certainty. Out-of-distribution English can still produce overconfident errors.

## Explanations

Contributions are normalized TF-IDF values multiplied by the underlying linear coefficients. Positive values move the raw score toward real-labeled examples; negative values move it toward fake-labeled examples. Intercepts and calibration also affect the displayed probability. The top 12 contributions are returned; the UI displays the top 8 and highlights matching individual words. A highlighted word is not evidence that a claim is true or false. Bigram contributions are shown in the chart and can span stopwords because the vectorizer removes stopwords before generating bigrams.

## Evaluation limitations

Both models score highly on the held-out historical samples. These scores must not be compared directly to results from other datasets or experimental splits. Near-duplicates and recognizable publisher/writing-style cues may remain. Scores are not established for Hindi, emerging news, screenshots, short claims, satire, opinion, or deliberately adversarial rewrites. Future work should test publisher and temporal holdouts and independent datasets before broad claims of accuracy.

Fact-check retrieval does not alter the classifier's result. Candidate sentences remain unverified. Related publisher reviews may address a different claim, date, or context; the UI preserves source attribution and original ratings.
