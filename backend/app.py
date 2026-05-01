"""Flask backend for TweetCheck prototype."""

from __future__ import annotations

import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

try:
    from .checkers import run_all_checkers
    from .claim_extractor import extract_claim
    from .news_search import search_whitelisted_news
    from .scoring import (
        assign_corroboration_verdict,
        build_alternatives,
        score_ai_risk,
        score_traceability,
    )
except ImportError:  # Allows running as a plain script from backend/
    from checkers import run_all_checkers
    from claim_extractor import extract_claim
    from news_search import search_whitelisted_news
    from scoring import (
        assign_corroboration_verdict,
        build_alternatives,
        score_ai_risk,
        score_traceability,
    )

load_dotenv()

app = Flask(__name__)
CORS(app)


@app.get("/health")
def health():
    return jsonify({"ok": True, "service": "TweetCheck backend"})


@app.post("/verify")
def verify():
    data = request.get_json(silent=True) or {}

    tweet_text = (data.get("tweetText") or "").strip()
    tweet_timestamp = data.get("tweetTimestamp")
    tweet_url = (data.get("tweetUrl") or "").strip()

    if not tweet_text:
        return jsonify({"ok": False, "error": "tweetText is required"}), 400

    claim_data = extract_claim(tweet_text)
    claim = (claim_data.get("claim") or "").strip() or tweet_text

    # Primary lookup uses extracted claim text.
    articles = search_whitelisted_news(claim, limit=8)

    # If claim extraction over-compressed the idea, retry with full tweet text.
    if not articles and claim != tweet_text:
        articles = search_whitelisted_news(tweet_text, limit=8)

    verdict = assign_corroboration_verdict(tweet_text, claim, articles)
    disclaimers = run_all_checkers(tweet_text, tweet_timestamp, articles)

    if verdict == "contradicted":
        contradicted_note = (
            "This claim appears to conflict with contradiction/debunking language in trusted-source coverage or the post itself."
        )
        if contradicted_note not in disclaimers:
            disclaimers.insert(0, contradicted_note)

    ai_risk = score_ai_risk(tweet_text, claim, articles)
    traceability = score_traceability(tweet_text, articles)
    alternatives = build_alternatives(articles)

    backend_mode = "live-newsapi" if os.getenv("NEWS_API_KEY", "").strip() else "no-newsapi-key"

    response = {
        "claimSummary": claim,
        "corroboration": verdict,
        "disclaimers": disclaimers,
        "aiRisk": ai_risk,
        "traceability": traceability,
        "alternatives": alternatives,
        "debug": {
            "claimExtractionMethod": claim_data.get("method", "fallback"),
            "backendMode": backend_mode,
            "articleCount": len(articles),
            "tweetUrl": tweet_url,
        },
    }

    return jsonify(response)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_ENV") == "development")
