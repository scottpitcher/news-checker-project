"""NewsAPI integration restricted to TweetCheck whitelist domains."""

from __future__ import annotations

import os
from typing import Dict, List, Optional
from urllib.parse import urlparse

import requests

try:
    from .whitelist import DOMAIN_TO_OUTLET, WHITELISTED_DOMAINS
except ImportError:  # Allows running as a plain script from backend/
    from whitelist import DOMAIN_TO_OUTLET, WHITELISTED_DOMAINS

NEWS_API_URL = "https://newsapi.org/v2/everything"


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


def search_whitelisted_news(query: str, limit: int = 8) -> List[Dict[str, str]]:
    """Search NewsAPI and return normalized whitelist-only article results.

    Important: returning an empty list means "no corroboration found in this lookup",
    not "the claim is false".
    """
    api_key = os.getenv("NEWS_API_KEY", "").strip()
    if not api_key:
        return []

    cleaned_query = (query or "").strip()
    if not cleaned_query:
        return []

    page_size = max(1, min(int(limit or 8), 20))

    params = {
        "q": cleaned_query,
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
        # Demo safety: fail closed to [] so the extension can still render.
        return []

    raw_articles = payload.get("articles") or []
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
