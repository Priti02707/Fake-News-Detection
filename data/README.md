# Dataset access

The original CSVs were committed in this repository and later removed. Restore the author's original 5,000-row-per-class samples locally:

```sh
python scripts/restore_data.py
```

This reads `Small_Fake.csv` and `Small_True.csv` from commit `afe1eb8`, without downloading third-party data or committing CSVs again. Article content appears consistent with the ISOT Fake and Real News corpus; exact provenance and redistribution rights were not documented by the original commits. Verify the original dataset terms before redistributing article text. The website distributes model parameters and aggregate evaluation only.

Alternatively supply your own `Fake.csv` and `True.csv` with `title` and `text` columns to `scripts/train.py --fake ... --real ...`. Labels are 0=fake, 1=real. Do not mix claim-level and article-level benchmarks without designing a separate experiment.
