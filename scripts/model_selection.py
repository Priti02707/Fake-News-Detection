"""Offline nested headline-group CV, confined to the training partition."""
import time
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC
from sklearn.model_selection import StratifiedGroupKFold, GroupShuffleSplit
from sklearn.metrics import f1_score, brier_score_loss, recall_score


def select_candidates(training):
    records = {'logistic': [], 'svm': []}
    outer = StratifiedGroupKFold(n_splits=3, shuffle=True, random_state=91)
    for fold, (rest, validation) in enumerate(outer.split(training, training.label, training.group)):
        fit_rel, cal_rel = next(GroupShuffleSplit(n_splits=1, test_size=.25, random_state=100 + fold).split(training.iloc[rest], groups=training.iloc[rest].group))
        fit, calibration = rest[fit_rel], rest[cal_rel]
        partitions = [training.iloc[index] for index in (fit, calibration, validation)]
        if any(part.label.nunique() != 2 for part in partitions):
            raise ValueError('Every CV fit/calibration/validation partition must contain both labels.')
        for i in range(3):
            for j in range(i):
                assert set(partitions[i].group).isdisjoint(partitions[j].group)
        vector = TfidfVectorizer(stop_words='english', ngram_range=(1, 2), min_df=2, max_df=.9, max_features=20000)
        fit_x = vector.fit_transform(partitions[0].content)
        cal_x, val_x = [vector.transform(part.content) for part in partitions[1:]]
        for key, estimator in [('logistic', LogisticRegression(max_iter=2500, class_weight='balanced', random_state=42)), ('svm', LinearSVC(max_iter=5000, class_weight='balanced', random_state=42))]:
            estimator.fit(fit_x, partitions[0].label)
            calibrator = LogisticRegression(C=1e6, max_iter=2000, random_state=42).fit(estimator.decision_function(cal_x).reshape(-1, 1), partitions[1].label)
            before = time.perf_counter()
            probs = calibrator.predict_proba(estimator.decision_function(val_x).reshape(-1, 1))[:, 1]
            elapsed = 1000 * (time.perf_counter() - before) / len(validation)
            predictions = probs >= .5
            records[key].append({'fold': fold, 'macro_f1': float(f1_score(partitions[2].label, predictions, average='macro')),
                'brier_score': float(brier_score_loss(partitions[2].label, probs)),
                'minimum_class_recall': float(min(recall_score(partitions[2].label, predictions, labels=[0, 1], average=None))),
                'scoring_ms_per_article': elapsed, 'splits': [len(part) for part in partitions], 'groups_disjoint': True})
    summary = {key: {metric: float(np.mean([row[metric] for row in rows])) for metric in ['macro_f1', 'brier_score', 'minimum_class_recall', 'scoring_ms_per_article']} for key, rows in records.items()}
    # Quantize metric ties for reproducibility. Timing is a recorded guard, not
    # a noisy tie-breaker. Stable model ID is the final tie-breaker.
    eligible = [key for key in records if summary[key]['scoring_ms_per_article'] <= 1000]
    if not eligible:
        raise ValueError('No model meets the scoring latency guard.')
    winner = sorted(eligible, key=lambda key: (-round(summary[key]['macro_f1'], 3), round(summary[key]['brier_score'], 3), -round(summary[key]['minimum_class_recall'], 3), key))[0]
    return {'schema_version': 1, 'selection_version': '2026-11-02.1', 'selected_model': winner, 'status': 'cv_selected',
            'reason': 'Three-fold nested headline-group CV within training only. Macro-F1 first (0.001 precision), then Brier score, minimum class recall, stable ID; latency <=1000ms scoring guard.',
            'evaluation_protocol': 'Outer final test and calibration partitions excluded. Each CV fold fits vocabulary/model on fit groups and calibrator on disjoint calibration groups; scores only disjoint validation groups.',
            'candidates': list(records), 'cv_results': records, 'cv_summary': summary,
            'training_rows': len(training), 'limits': ['Historical English writing patterns only; no claim verification or publisher/temporal generalization guarantee.']}
