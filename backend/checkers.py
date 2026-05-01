"""Contextual checker rules used as disclaimers.

These checks add uncertainty/context warnings and do not mark claims as false.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Iterable, List, Optional


HEDGED_PATTERN = re.compile(
    r"\b(reportedly|sources say|source says|unconfirmed|allegedly|rumou?r|developing|"
    r"it is said|people are saying|claims? that|according to reports?)\b",
    re.IGNORECASE,
)


def parse_datetime(value) -> Optional[datetime]:
    """Parse common timestamp formats and return timezone-aware UTC datetimes."""
    if not value:
        return None

    if isinstance(value, datetime):
        dt = value
    else:
        raw = str(value).strip()
        if not raw:
            return None

        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"

        dt = None
        for parser in (
            lambda s: datetime.fromisoformat(s),
            lambda s: datetime.strptime(s, "%Y-%m-%d %H:%M:%S"),
            lambda s: datetime.strptime(s, "%Y-%m-%d"),
        ):
            try:
                dt = parser(raw)
                break
            except Exception:
                continue
        if dt is None:
            return None

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def check_tweet_age(tweet_timestamp) -> List[str]:
    disclaimers: List[str] = []
    ts = parse_datetime(tweet_timestamp)
    if ts is None:
        return disclaimers

    age_days = (datetime.now(timezone.utc) - ts).total_seconds() / 86400.0
    if age_days > 30:
        disclaimers.append(
            "This post is over a month old — check whether newer reporting has changed the picture."
        )
    elif age_days > 7:
        disclaimers.append("This post is more than 7 days old — context may have changed.")

    return disclaimers


def check_breaking_news(tweet_timestamp, articles: Iterable[dict]) -> List[str]:
    disclaimers: List[str] = []
    now = datetime.now(timezone.utc)
    ts = parse_datetime(tweet_timestamp)

    article_list = list(articles or [])

    if ts is not None:
        tweet_age_hours = (now - ts).total_seconds() / 3600.0
        if tweet_age_hours < 2 and not article_list:
            disclaimers.append(
                "No corroboration found yet — this post may be ahead of news coverage."
            )

    article_times = []
    for item in article_list:
        parsed = parse_datetime(item.get("publishedAt"))
        if parsed is not None:
            article_times.append(parsed)

    if article_times and all((now - t).total_seconds() / 3600.0 < 3 for t in article_times):
        disclaimers.append(
            "Coverage of this claim is very recent — details may change as reporting develops."
        )

    return disclaimers


def check_hedged_language(tweet_text: str) -> List[str]:
    if not tweet_text:
        return []
    if HEDGED_PATTERN.search(tweet_text):
        return [
            "This post uses hedged or unconfirmed language, so the claim may not be verified even by the poster."
        ]
    return []


def check_no_coverage(tweet_timestamp, articles: Iterable[dict]) -> List[str]:
    article_list = list(articles or [])
    if article_list:
        return []

    ts = parse_datetime(tweet_timestamp)
    if ts is None:
        return [
            "No coverage was found in the current whitelist. Treat this as inconclusive, not automatically false."
        ]

    age_hours = (datetime.now(timezone.utc) - ts).total_seconds() / 3600.0
    if age_hours < 24:
        return [
            "No corroboration was found in the whitelist yet. This may be a fast-moving story still awaiting broader coverage."
        ]

    return [
        "No coverage was found in the current whitelist. For an older post, treat this as a caution signal and verify carefully."
    ]


def check_source_concentration(articles: Iterable[dict]) -> List[str]:
    article_list = list(articles or [])
    if len(article_list) < 2:
        return []

    families = {str(a.get("family") or a.get("outlet") or "").strip().lower() for a in article_list}
    families.discard("")
    if len(families) == 1:
        return [
            "Matched coverage appears concentrated in one outlet family, so viewpoint diversity may be limited."
        ]
    return []


def check_geographic_coverage(articles: Iterable[dict]) -> List[str]:
    article_list = list(articles or [])
    if len(article_list) < 2:
        return []

    countries = {str(a.get("country") or "").strip().lower() for a in article_list}
    countries.discard("")
    if len(countries) == 1:
        return [
            "Coverage appears concentrated in one country/region, so cross-region context may be limited."
        ]
    return []


def check_opinion_or_satire(articles: Iterable[dict]) -> List[str]:
    for item in articles or []:
        a_type = str(item.get("type") or "").strip().lower()
        if a_type in {"opinion", "satire"}:
            return [
                "At least one matched item is categorized as opinion/satire, so it should not be treated as straight reporting."
            ]
    return []


def run_all_checkers(tweet_text: str, tweet_timestamp, articles: Iterable[dict]) -> List[str]:
    """Run all contextual checkers and return unique disclaimer strings."""
    batches = [
        check_tweet_age(tweet_timestamp),
        check_breaking_news(tweet_timestamp, articles),
        check_hedged_language(tweet_text),
        check_no_coverage(tweet_timestamp, articles),
        check_source_concentration(articles),
        check_geographic_coverage(articles),
        check_opinion_or_satire(articles),
    ]

    seen = set()
    result = []
    for batch in batches:
        for item in batch:
            if item not in seen:
                seen.add(item)
                result.append(item)
    return result
