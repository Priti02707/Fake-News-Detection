"""Article-task validation and pure preprocessing; labels from other tasks stay separate."""
import hashlib
import html
import re
import unicodedata
from pathlib import Path

import pandas as pd


def clean_text(value):
    text = html.unescape(str(value))
    text = re.sub(r"(?is)<(script|style)\b[^>]*>.*?</\1>", " ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", text)).strip()


def prepare_articles(fake, real):
    frames, report = [], {"sources": [], "missing_values": {}, "preprocessing": "NFKC normalization, HTML entity/tag/script/style removal, whitespace normalization; no test-fitted transformations"}
    for path, label in [(Path(fake), 0), (Path(real), 1)]:
        frame = pd.read_csv(path, on_bad_lines="error")
        if not {"title", "text"}.issubset(frame.columns): raise ValueError("Article CSVs require title and text columns.")
        report["missing_values"][path.name] = {key: int(frame[key].isna().sum()) for key in ["title", "text"]}
        report["sources"].append({"file": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "rows": len(frame), "label": label})
        frame = frame.fillna("")
        if any(not isinstance(value, str) for value in frame["text"]): raise ValueError("Every non-missing article text must be a string.")
        frame["label"] = label
        frame["title"] = frame.title.map(clean_text); frame["text"] = frame.text.map(clean_text)
        frames.append(frame)
    data = pd.concat(frames, ignore_index=True)
    data["content"] = data.title + " " + data.text
    normalize = lambda value: re.sub(r"\W+", " ", value.lower()).strip()
    data["key"] = data.content.map(normalize)
    report["short_or_empty"] = int((data.key.str.len() < 60).sum())
    data = data[data.key.str.len() >= 60].copy()
    labels = data.groupby("key").label.nunique()
    conflicting = set(labels[labels > 1].index)
    report["conflicting_content_groups"] = len(conflicting)
    report["conflicting_rows_removed"] = int(data.key.isin(conflicting).sum())
    data = data[~data.key.isin(conflicting)]
    report["exact_normalized_duplicates_removed"] = int(data.duplicated("key").sum())
    data = data.drop_duplicates("key").reset_index(drop=True)
    data["group"] = data.title.map(normalize)
    data.loc[data.group.str.len() < 12, "group"] = data.loc[data.group.str.len() < 12, "key"]
    report["usable_rows"] = len(data)
    report["publisher_field"] = next((column for column in ["publisher", "source"] if column in data and data[column].astype(str).str.len().gt(0).all()), None)
    report["publisher_leakage_analysis"] = "Provided publisher groups can be held out; metadata authenticity is not independently established." if report["publisher_field"] else "Unavailable: original files have no authenticated publisher/source column. Reuters-style text cues are not treated as publisher IDs."
    report["language_detection"] = "Not sampled yet"
    return data, report
