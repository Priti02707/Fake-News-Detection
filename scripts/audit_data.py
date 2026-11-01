import argparse
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.data_pipeline import prepare_articles
from scripts.evaluate import run_experiment
from backend.language import identify_language


def semantic_experiment(data, maximum=500):
    import numpy as np
    from huggingface_hub import model_info
    from sentence_transformers import SentenceTransformer
    from sklearn.model_selection import train_test_split, GroupShuffleSplit
    from sklearn.neighbors import NearestNeighbors
    if len(data) > maximum:
        selected, _ = train_test_split(np.arange(len(data)), train_size=maximum, stratify=data.label, random_state=42)
        data = data.iloc[selected].copy().reset_index(drop=True)
    else: data = data.copy().reset_index(drop=True)
    model_id = "sentence-transformers/all-MiniLM-L6-v2"
    revision = model_info(model_id).sha
    encoder = SentenceTransformer(model_id, revision=revision, device="cpu", cache_folder=str(ROOT / ".cache/huggingface"))
    encoder.max_seq_length = 256
    vectors = encoder.encode(data.content.tolist(), batch_size=16, normalize_embeddings=True, show_progress_bar=False)
    distances, neighbors = NearestNeighbors(n_neighbors=min(8, len(data)), metric="cosine").fit(vectors).kneighbors(vectors)
    roots = list(range(len(data)))
    def find(index):
        while roots[index] != index:
            roots[index] = roots[roots[index]]; index = roots[index]
        return index
    def union(a, b): roots[find(a)] = find(b)
    for _, group in data.groupby("group"):
        for index in group.index[1:]: union(group.index[0], index)
    pairs = set()
    for index, (scores, matches) in enumerate(zip(distances, neighbors)):
        for distance, other in zip(scores, matches):
            if index != other and 1 - distance >= .95:
                union(index, int(other)); pairs.add(tuple(sorted([index, int(other)])))
    data["group"] = [f"semantic-{find(index)}" for index in range(len(data))]
    rest, test = next(GroupShuffleSplit(n_splits=1, test_size=.2, random_state=42).split(data, groups=data.group))
    tr, cal = next(GroupShuffleSplit(n_splits=1, test_size=.25, random_state=43).split(data.iloc[rest], groups=data.iloc[rest].group))
    experiment = run_experiment(data, (rest[tr], rest[cal], test), f"Semantic-cluster holdout on {len(data)} sampled articles")
    experiment["semantic_protocol"] = {"model": model_id, "revision": revision, "cosine_threshold": .95, "sampled_articles": len(data), "nearest_neighbors_per_article": 8, "candidate_pairs": len(pairs), "maximum_tokens": 256, "note": "This is a sampled diagnostic, not full-corpus semantic deduplication. Similarity clusters can include different articles about the same event."}
    return experiment


def main(fake, real, semantic, limit):
    data, audit = prepare_articles(fake, real)
    sampled = data.sample(min(100, len(data)), random_state=42)
    audit["language_detection"] = {"sample_size": len(sampled), "codes": dict(Counter(identify_language(value)["code"] for value in sampled.content)), "method": "Seeded sample; heuristic language detection, not a language benchmark"}
    audit["generated_at"] = datetime.now(timezone.utc).isoformat()
    audit["dataset_task"] = "article-level labels: 0 fake-labeled, 1 real-labeled"
    audit["license_status"] = "Original repository sample provenance/redistribution terms remain unverified. Raw article content is not redistributed."
    destination = ROOT / "reports"; destination.mkdir(exist_ok=True)
    if semantic:
        experiment = semantic_experiment(data, limit)
        (destination / "semantic-holdout.json").write_text(json.dumps(experiment, indent=2))
        audit["semantic_diagnostic"] = experiment["semantic_protocol"]
        path = ROOT / "models/robustness.json"
        report = json.loads(path.read_text())
        report["experiments"] = [entry for entry in report["experiments"] if not entry["name"].startswith("Semantic-cluster")] + [experiment]
        report["availability"]["semantic_deduplication"] = f"Sampled diagnostic measured on {experiment['semantic_protocol']['sampled_articles']} articles; not full-corpus deduplication."
        path.write_text(json.dumps(report, indent=2))
    (destination / "dataset-audit.json").write_text(json.dumps(audit, indent=2))
    print(json.dumps(audit, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--fake", type=Path, default=ROOT / "data/Fake.csv")
    parser.add_argument("--real", type=Path, default=ROOT / "data/True.csv")
    parser.add_argument("--semantic", action="store_true")
    parser.add_argument("--limit", type=int, default=500)
    args = parser.parse_args()
    if args.limit < 100 or args.limit > 10000: raise ValueError("The semantic sample limit must be between 100 and 10000.")
    main(args.fake, args.real, args.semantic, args.limit)
