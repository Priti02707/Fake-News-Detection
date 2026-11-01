# Dataset contracts and provenance

The existing recovered CSVs contain 5,000 rows per label with `title`, `text`, `subject`, and `date`. They are the repository author's historical samples, apparently consistent with ISOT-style content; exact original provenance and redistribution rights were not established by the commits. Only derived parameters and aggregate reports are distributed. The raw CSVs remain ignored.

`scripts/data_pipeline.py` validates article schemas, records missing values/checksums, cleans HTML/entities and Unicode, removes short/empty content, exact normalized duplicates, and conflicting-label groups, and preserves headline grouping. These new research transformations do not silently change the production vectorizer. Language identification is fallible and its audit reports the actual sampled subset.

`scripts/audit_data.py --semantic --limit 500` measures a declared sample using pinned MiniLM embeddings, up to eight nearest neighbors and a predeclared 0.95 cosine threshold. Connected similarity/headline groups stay together across partitions. This is not a claim of exhaustive semantic deduplication; related but distinct event reporting may be clustered. Reports record model revision, sample size, pair counts and limits.

The original files have no authenticated publisher IDs. Dates support chronological experiments; publisher holdout remains a documented gap. Source-marker removal is a stress test, not a replacement for publisher metadata.

LIAR, FEVER, AVeriTeC, FakeNewsNet and other datasets are not silently downloaded or merged. Article labels, short-claim truth labels, evidence entailment labels, and multimodal context labels are distinct tasks. Before external evaluation, supply licensed accessible data and a manifest identifying provenance, task, label mapping, dates and restrictions. No external dataset metric is claimed merely because a download script exists.

External article evaluation is implemented in `scripts/evaluate_external.py` with a required task/license/label manifest and normalized overlap exclusion. The code path has a synthetic unit fixture; no real external-corpus result is claimed until an accessible, appropriately licensed independent dataset is supplied.
