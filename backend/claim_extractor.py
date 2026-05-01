"""Claim extraction utilities for TweetCheck.

OpenAI support is optional. If the API key is missing or the call fails,
we always fall back to deterministic text cleaning so demos never break.
"""

from __future__ import annotations

import os
import re
from typing import Dict

try:
    from openai import OpenAI
except Exception:  # pragma: no cover - optional dependency path
    OpenAI = None  # type: ignore


def _clean_tweet_text(tweet_text: str) -> str:
    """Normalize tweet text into a stable fallback claim string."""
    text = tweet_text or ""
    text = re.sub(r"\s+", " ", text).strip()

    # Keep user-facing text concise for the panel.
    if len(text) > 280:
        text = text[:277].rstrip() + "..."
    return text


def _extract_with_openai(clean_text: str) -> str:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key or OpenAI is None:
        raise RuntimeError("OpenAI not configured")

    client = OpenAI(api_key=api_key)
    model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

    prompt = (
        "Extract the single core factual claim from this post. "
        "Return one short sentence only, no bullets, no quotes.\n\n"
        f"Post: {clean_text}"
    )

    response = client.responses.create(model=model, input=prompt)
    claim = (response.output_text or "").strip()

    # Defensive cleanup in case the model returns surrounding quotes.
    claim = claim.strip().strip('"').strip("'").strip()
    return claim


def extract_claim(tweet_text: str) -> Dict[str, str]:
    """Return a claim summary and extraction method.

    Returns:
        {
          "claim": "...",
          "method": "openai" | "fallback"
        }
    """
    clean_text = _clean_tweet_text(tweet_text)
    if not clean_text:
        return {"claim": "", "method": "fallback"}

    try:
        claim = _extract_with_openai(clean_text)
        if claim:
            return {"claim": claim, "method": "openai"}
    except Exception:
        # Never fail the verify flow because of model issues.
        pass

    return {"claim": clean_text, "method": "fallback"}
