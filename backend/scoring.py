"""Rule-based scoring for TweetCheck prototype outputs."""

from __future__ import annotations

import re
from typing import Dict, Iterable, List


CONTRADICTION_TERMS = re.compile(
    r"\b(false|hoax|debunked|debunk|misleading|contradicted|fabricated|not true|fake)\b",
    re.IGNORECASE,
)

VAGUE_SOURCING = re.compile(
    r"\b(experts say|studies show|people are saying|sources say|everyone knows|reportedly)\b",
    re.IGNORECASE,
)

HIGH_CONFIDENCE = re.compile(
    r"\b(definitely|without doubt|undeniable|guaranteed|100%|proven)\b",
    re.IGNORECASE,
)

PROMOTIONAL = re.compile(
    r"\b(shocking|must see|you won't believe|game changer|mind blowing|breaking the internet)\b",
    re.IGNORECASE,
)

URL_PATTERN = re.compile(r"https?://", re.IGNORECASE)


def _extract_simple_entities(text: str) -> List[Dict[str, str]]:
    """Very light entity extraction for traceability hints.

    We only need rough, explainable hooks for demo scoring.
    """
    if not text:
        return []

    entities: List[Dict[str, str]] = []
    seen = set()

    # Capture 1-3 capitalized words as simple named entities.
    for match in re.findall(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b", text):
        name = match.strip()
        if len(name) < 3:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        entities.append({"type": "entity", "name": name})

    return entities[:12]


def assign_corroboration_verdict(tweet_text: str, claim: str, articles: Iterable[dict]) -> str:
    """Return one of: corroborated | unverified | contradicted."""
    article_list = list(articles or [])

    blob_parts = [tweet_text or "", claim or ""]
    for article in article_list:
        blob_parts.append(article.get("title") or "")
        blob_parts.append(article.get("description") or "")
    combined_text = " ".join(blob_parts)

    # Contradiction keywords get priority for the misinformation demo path.
    if CONTRADICTION_TERMS.search(combined_text):
        return "contradicted"

    if len(article_list) >= 2:
        return "corroborated"

    return "unverified"


def score_ai_risk(tweet_text: str, claim: str, articles: Iterable[dict]) -> Dict[str, object]:
    """Heuristic AI-risk signal.

    This is not proof of AI-generated content, only a style-risk indicator.
    """
    text = " ".join([tweet_text or "", claim or ""]).strip()
    reasons: List[str] = []
    score = 0

    if VAGUE_SOURCING.search(text):
        score += 30
        reasons.append("The post uses vague sourcing language (for example, 'experts say' or 'sources say').")

    if not URL_PATTERN.search(tweet_text or ""):
        score += 20
        reasons.append("The post does not include a direct link or citation.")

    if HIGH_CONFIDENCE.search(text):
        score += 25
        reasons.append("The post uses very confident wording without naming a clear source.")

    if PROMOTIONAL.search(text):
        score += 20
        reasons.append("The phrasing is highly promotional or sensational.")

    if len(list(articles or [])) == 0:
        score += 10
        reasons.append("No whitelisted coverage was found in this lookup.")

    if score >= 60:
        level = "high"
        headline = "Several AI-risk style signals detected"
    elif score >= 30:
        level = "medium"
        headline = "Some AI-risk signals detected"
    else:
        level = "low"
        headline = "Few AI-risk style signals detected"

    if not reasons:
        reasons = ["The post includes concrete wording with fewer high-risk style cues."]

    return {
        "level": level,
        "headline": headline,
        "reasons": reasons,
    }


def score_traceability(tweet_text: str, articles: Iterable[dict]) -> Dict[str, object]:
    """Return an explainable 0-100 traceability score."""
    article_list = list(articles or [])
    citations = len(re.findall(r"https?://\S+", tweet_text or ""))

    base_entities = _extract_simple_entities(tweet_text or "")

    # Add matched outlet names as verifiable entities.
    seen_names = {e["name"].lower() for e in base_entities}
    for article in article_list:
        outlet = (article.get("outlet") or "").strip()
        if outlet and outlet.lower() not in seen_names:
            base_entities.append({"type": "outlet", "name": outlet})
            seen_names.add(outlet.lower())

    unique_outlets = {str(a.get("outlet") or "").strip().lower() for a in article_list}
    unique_outlets.discard("")

    score = 10
    score += min(40, len(article_list) * 15)
    score += min(20, citations * 10)
    score += min(20, len(base_entities) * 3)
    if len(unique_outlets) >= 2:
        score += 10

    score = max(0, min(100, score))

    if score >= 70:
        label = "Strong"
    elif score >= 40:
        label = "Limited"
    else:
        label = "Weak"

    notes: List[str] = []
    if len(article_list) >= 2:
        notes.append("Multiple whitelisted outlets were found.")
    elif len(article_list) == 1:
        notes.append("Only one whitelisted outlet was found so far.")
    else:
        notes.append("No whitelisted outlets were found for this lookup.")

    if citations > 0:
        notes.append("The post includes at least one external link.")
    else:
        notes.append("The post does not include an external link.")

    if base_entities:
        notes.append("The post includes named entities that can be checked.")
    else:
        notes.append("The post has limited named entities to verify.")

    return {
        "score": score,
        "label": label,
        "sourcesFound": len(article_list),
        "citationsInTweet": citations,
        "entities": base_entities,
        "notes": notes,
    }


def build_alternatives(articles: Iterable[dict]) -> List[Dict[str, str]]:
    """Convert article matches into panel-friendly alternative reads."""
    alternatives: List[Dict[str, str]] = []
    seen = set()

    for article in articles or []:
        url = (article.get("url") or "").strip()
        if not url or url in seen:
            continue
        seen.add(url)
        alternatives.append(
            {
                "outlet": (article.get("outlet") or "Whitelisted outlet").strip(),
                "title": (article.get("title") or "Related coverage").strip(),
                "url": url,
                "note": "Whitelisted source covering a related claim.",
            }
        )

    return alternatives[:6]
