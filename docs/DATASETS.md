# Dataset contracts and provenance

The existing recovered CSVs contain 5,000 rows per label with `title`, `text`, `subject`, and `date`. They are the repository author's historical samples, apparently consistent with ISOT-style content; exact original provenance and redistribution rights were not established by the commits. Only derived parameters and aggregate reports are distributed. The raw CSVs remain ignored.

`scripts/data_pipeline.py` validates article schemas, records missing values/checksums, cleans HTML/entities and Unicode, removes short/empty content, exact normalized duplicates, and conflicting-label groups, and preserves headline grouping. These new research transformations do not silently change the production vectorizer. Language identification is fallible and its audit reports the actual sampled subset.

`scripts/audit_data.py --semantic --limit 500` measures a declared sample using pinned MiniLM embeddings, up to eight nearest neighbors and a predeclared 0.95 cosine threshold. Connected similarity/headline groups stay together across partitions. This is not a claim of exhaustive semantic deduplication; related but distinct event reporting may be clustered. Reports record model revision, sample size, pair counts and limits.

The original files have no authenticated publisher IDs. Dates support chronological experiments; publisher holdout remains a documented gap. Source-marker removal is a stress test, not a replacement for publisher metadata.

LIAR, FEVER, AVeriTeC, FakeNewsNet and other datasets are not silently downloaded or merged. Article labels, short-claim truth labels, evidence entailment labels, and multimodal context labels are distinct tasks. Before external evaluation, supply licensed accessible data and a manifest identifying provenance, task, label mapping, dates and restrictions. No external dataset metric is claimed merely because a download script exists.

External article evaluation is implemented in `scripts/evaluate_external.py` with a required task/license/label manifest and normalized overlap exclusion. The code path has a synthetic unit fixture; no real external-corpus result is claimed until an accessible, appropriately licensed independent dataset is supplied.

## Classification upgrade — 2026-11-02

No paired multimodal corpus was acquired by the classification upgrade. Fusion training requires operator-reviewed licensing, explicit 0=fake / 1=real labels, feature checksums, encoder revisions, and publisher/duplicate-group disjoint train/validation/test partitions. Synthetic test vectors verify execution only. See [the NPZ/manifest contract](ADVANCED_CLASSIFICATION_AUDIT.md).

## Master-prompt acquisition plan — no downloads in Phase 0

| Candidate | Intended task/modalities | Rights/access, label and evaluation prerequisites |
| --- | --- | --- |
| [Fakeddit](https://github.com/entitize/Fakeddit) | English Reddit text/image pairs and metadata; contextual mismatch/fusion research | Read the official Usage/access instructions and source-media terms. Inspect available binary/finer labels rather than equating all labels with factual falsehood. Record actual acquired counts, missing images, class imbalance and publisher/subreddit shortcuts; split duplicate images/stories together. |
| LIAR (Wang, 2017) | English short political claims and graded truth labels | Locate and verify the original release, applicable terms, label mapping and split provenance before download. Claim labels are not full-article or image labels. Source/speaker/time leakage and class imbalance need an audit. No LIAR data or result is bundled. |
| [FakeNewsNet](https://github.com/KaiDMML/FakeNewsNet) | News articles plus available social context | Review collection/access restrictions and third-party platform/source terms; record which content remains obtainable, labels and sampling bias. Do not assume image availability or redistribution rights. |
| Hindi/mixed-language corpus | Separate language-specific article/claim evaluation | No corpus selected or acquired. Require documented source, license, label policy, counts, imbalance and independent publishers/dates. Translation does not substitute for Hindi validation. |
| Manipulation/video corpus | Media-forensic task, distinct from contextual fake-news labels | Select only after license/access and consent review. Record authentic/manipulated/synthetic definitions, source videos, identity leakage, frame grouping and held-out generators. No forensic corpus or checkpoint acquired. |

Dataset sizes/class balances in the acquisition manifest must reflect files actually inspected; they are not inferred from website totals. Before acquisition record source URL/revision, license/access review, text/image/video/speech alignment, language, exact labels, intended task, hashes, actual counts, duplicates, missing data, split strategy and restrictions. Data and large model binaries stay ignored. Missing access or uncertain rights blocks acquisition, not an excuse to fabricate a corpus. Existing results retain their original provenance.
