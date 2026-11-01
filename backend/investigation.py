"""Traceable claim candidates and passage retrieval, without factual truth labels."""
import hashlib
import math
import re
from collections import Counter
from datetime import datetime, timezone

STOP = set("a an the and or to of in on at for from with by is are was were be been this that it as its has have had not".split())


def publication_context(published_date, now=None):
    """A date review aid; age alone does not determine evidence relevance."""
    now = now or datetime.now(timezone.utc)
    result = {"review_window_days": 365, "checked_at": now.isoformat(), "age_days": None}
    if not published_date:
        return {**result, "status": "missing", "message": "Publication date is unknown. Check the source date and whether it matches the claim's timeframe."}
    try:
        published = datetime.fromisoformat(published_date.replace("Z", "+00:00"))
        published = published.replace(tzinfo=timezone.utc) if published.tzinfo is None else published.astimezone(timezone.utc)
    except (ValueError, TypeError, AttributeError, OverflowError):
        return {**result, "status": "invalid", "message": "The source-reported publication date could not be interpreted. Check it in the original source."}
    age = (now.astimezone(timezone.utc).date() - published.date()).days
    if age < 0:
        status, message = "future", "The source-reported publication date is in the future. Check its metadata and the claim's timeframe."
    elif age > result["review_window_days"]:
        status, message = "older_than_review_window", "This source is more than one year old. It may be outdated for a current claim or appropriate for a historical claim; check dates and context."
    else:
        status, message = "within_review_window", "The source-reported date is within the past year. Recency does not establish reliability or factual support."
    return {**result, "age_days": age, "status": status, "message": message}


def tokens(text):
    return [token for token in re.findall(r"\w+", text.lower()) if token not in STOP and len(token) > 1]


def sentences(text):
    for paragraph in re.finditer(r"[^\n]+", text):
        for match in re.finditer(r".+?(?:[.!?।](?=\s|$)|$)", paragraph.group()):
            start = paragraph.start() + match.start() + len(match.group()) - len(match.group().lstrip())
            value = match.group().strip()
            if value:
                yield value, start


def select_claims(text, limit=6):
    candidates, seen = [], set()
    for sentence, start in sentences(text):
        if len(sentence.split()) < 8:
            continue
        reasons = []
        if re.search(r"\b\d[\d,.%]*\b", sentence): reasons.append("Contains a number or date")
        if re.search(r"\b(announced|reported|approved|confirmed|increased|decreased|published|launched|died|won|banned|found|said)\b|घोषणा|प्रतिशत|सरकार", sentence, re.I): reasons.append("Describes a reported event or statement")
        if re.search(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b", sentence): reasons.append("Names a person, place, or organization")
        score = len(reasons) * 2 + min(len(sentence.split()), 40) / 40
        if re.search(r"\b(I think|I believe|in my opinion|should|wonderful|terrible)\b", sentence, re.I): score -= 2
        excerpt = sentence[:300]
        key = " ".join(tokens(excerpt))
        if key in seen: continue
        seen.add(key)
        candidates.append({"text": excerpt, "status": "unverified", "start": start, "end": start + len(excerpt), "reasons": reasons or ["Candidate statement for reader review"], "selection_method": "heuristic", "truncated": len(sentence) > 300, "score": score})
    ranked = sorted(candidates, key=lambda item: (-item["score"], item["start"]))[:limit]
    return [{key: value for key, value in item.items() if key != "score"} for item in ranked]


def retrieve_passages(query, text, limit=8):
    passages = []
    for sentence, start in sentences(text):
        for offset in range(0, len(sentence), 700):
            excerpt = sentence[offset:offset + 700]
            if len(excerpt.strip()) >= 30:
                passages.append((excerpt, start + offset))
    terms = set(tokens(query))
    counts = [Counter(tokens(value)) for value, _ in passages]
    avg_length = sum(sum(item.values()) for item in counts) / max(1, len(counts))
    document_frequency = {term: sum(term in item for item in counts) for term in terms}
    ranked = []
    for (value, start), frequencies in zip(passages, counts):
        score = 0.
        for term in terms:
            frequency = frequencies[term]
            containing = document_frequency[term]
            idf = math.log(1 + (len(counts) - containing + .5) / (containing + .5))
            denominator = frequency + 1.2 * (.25 + .75 * sum(frequencies.values()) / max(1, avg_length))
            score += idf * frequency * 2.2 / max(1e-9, denominator)
        if score > 0:
            ranked.append({"id": hashlib.sha256(f"{start}:{value}".encode()).hexdigest()[:16], "text": value, "start": start, "end": start + len(value), "retrieval_score": round(score, 5)})
    unique, seen = [], set()
    for item in sorted(ranked, key=lambda item: (-item["retrieval_score"], item["start"])):
        key = " ".join(item["text"].split())
        if key not in seen:
            seen.add(key)
            unique.append(item)
    return unique[:limit]
