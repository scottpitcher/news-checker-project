"""NewsAPI integration restricted to TweetCheck whitelist domains."""

from __future__ import annotations

import os
import re
from typing import Dict, List, Optional
from urllib.parse import urlparse

import requests

try:
    from .whitelist import DOMAIN_TO_OUTLET, WHITELISTED_DOMAINS
except ImportError:  # Allows running as a plain script from backend/
    from whitelist import DOMAIN_TO_OUTLET, WHITELISTED_DOMAINS

NEWS_API_URL = "https://newsapi.org/v2/everything"

# Common English stopwords + filler words that hurt NewsAPI keyword matching.
_STOPWORDS = {
    "a", "an", "and", "or", "but", "if", "the", "this", "that", "these", "those",
    "is", "are", "was", "were", "be", "been", "being", "am", "do", "does", "did",
    "have", "has", "had", "having", "of", "in", "on", "at", "to", "from", "by",
    "for", "with", "about", "as", "into", "through", "after", "before", "between",
    "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
    "my", "your", "his", "its", "our", "their", "what", "which", "who", "whom",
    "whose", "where", "when", "why", "how", "all", "any", "both", "each", "few",
    "more", "most", "other", "some", "such", "no", "not", "only", "own", "same",
    "so", "than", "too", "very", "can", "will", "just", "should", "now", "would",
    "could", "may", "might", "must", "shall", "also", "then", "there", "here",
    "say", "says", "said", "saying", "tell", "told", "report", "reports", "reported",
    "reportedly", "according", "showing", "shown", "show", "shows", "see", "seen",
    "watch", "video", "post", "tweet", "thread", "viral",
    "breaking", "update", "live",
    "release", "released", "releases", "make", "makes", "made", "get", "gets",
    "got", "go", "goes", "went", "come", "comes", "came", "take", "takes", "took",
    "use", "uses", "used", "look", "looks", "looked", "find", "finds", "found",
    "depict", "depicts", "depicting", "depicted",
    "new", "old", "first", "last", "next", "many", "much", "every", "another",
    "today", "yesterday", "tomorrow", "year", "years", "day", "days", "time", "times",
}


def _normalize_domain(url: str) -> str:
    netloc = urlparse(url or "").netloc.lower().strip()
    if netloc.startswith("www."):
        netloc = netloc[4:]
    return netloc


def _resolve_outlet(domain: str) -> Optional[Dict[str, str]]:
    if not domain:
        return None
    if domain in DOMAIN_TO_OUTLET:
        return DOMAIN_TO_OUTLET[domain]

    # Allow subdomains like edition.cnn.com -> cnn.com.
    for whitelist_domain, outlet in DOMAIN_TO_OUTLET.items():
        if domain.endswith("." + whitelist_domain):
            return outlet
    return None


def _extract_keywords(text: str, max_keywords: int = 5) -> List[str]:
    """Pick the most search-worthy tokens from a claim/tweet.

    Strategy: keep proper nouns (capitalized words) first, then content words,
    drop stopwords and short tokens, dedupe case-insensitively, preserve order.
    """
    if not text:
        return []

    cleaned = re.sub(r"https?://\S+", " ", text)
    cleaned = re.sub(r"[#@]\w+", " ", cleaned)

    tokens = re.findall(r"[A-Za-z][A-Za-z'-]{2,}", cleaned)

    proper: List[str] = []
    other: List[str] = []
    seen = set()

    for token in tokens:
        lowered = token.lower()
        if lowered in _STOPWORDS:
            continue
        if lowered in seen:
            continue
        seen.add(lowered)

        # Treat as a proper noun if it starts with uppercase but isn't the
        # leading sentence-cap word that's also a known stopword.
        if token[0].isupper() and not token.isupper():
            proper.append(token)
        elif token.isupper() and len(token) > 1:
            # Acronyms like NASA, NATO.
            proper.append(token)
        else:
            other.append(token)

    return (proper + other)[:max_keywords]


def _run_search(query: str, api_key: str, page_size: int) -> List[dict]:
    params = {
        "q": query,
        "domains": ",".join(WHITELISTED_DOMAINS),
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": page_size,
    }
    try:
        response = requests.get(
            NEWS_API_URL,
            params=params,
            headers={"X-Api-Key": api_key},
            timeout=10,
        )
        response.raise_for_status()
        payload = response.json()
    except Exception:
        return []
    return payload.get("articles") or []


def search_whitelisted_news(query: str, limit: int = 8) -> List[Dict[str, str]]:
    """Search NewsAPI and return normalized whitelist-only article results.

    Important: returning an empty list means "no corroboration found in this lookup",
    not "the claim is false".

    Tries multiple progressively-broader queries because NewsAPI's `q` ANDs
    every word, so a verbose claim sentence rarely matches anything when
    restricted to a small whitelist of outlets.
    """
    api_key = os.getenv("NEWS_API_KEY", "").strip()
    if not api_key:
        return []

    cleaned_query = (query or "").strip()
    if not cleaned_query:
        return []

    page_size = max(1, min(int(limit or 8), 20))

    queries: List[str] = []
    queries.append(cleaned_query)

    keywords = _extract_keywords(cleaned_query, max_keywords=6)
    if keywords:
        # Try progressively shorter AND-joined keyword queries. NewsAPI ANDs every
        # word in `q`, so 6 tokens may match nothing while 3 tokens match plenty.
        # We never go below 3 keywords because shorter queries (e.g. just
        # "China" + "driver") match too many unrelated articles and produce
        # spurious "corroborated" verdicts on niche/satirical claims.
        for n in (6, 4, 3):
            if n > len(keywords):
                continue
            joined = " ".join(keywords[:n])
            if joined and joined not in queries:
                queries.append(joined)

    raw_articles: List[dict] = []
    for q in queries:
        raw_articles = _run_search(q, api_key, page_size)
        if raw_articles:
            break

    normalized: List[Dict[str, str]] = []
    seen_urls = set()

    for article in raw_articles:
        url = (article.get("url") or "").strip()
        if not url or url in seen_urls:
            continue

        domain = _normalize_domain(url)
        outlet_meta = _resolve_outlet(domain)
        if outlet_meta is None:
            continue

        seen_urls.add(url)
        normalized.append(
            {
                "outlet": outlet_meta["name"],
                "domain": outlet_meta["domain"],
                "title": (article.get("title") or "").strip(),
                "url": url,
                "description": (article.get("description") or "").strip(),
                "publishedAt": (article.get("publishedAt") or "").strip(),
                "country": outlet_meta.get("region", "Unknown"),
                "type": outlet_meta.get("type", "news"),
                "family": outlet_meta.get("family", outlet_meta["name"]),
            }
        )

    return normalized[:page_size]
