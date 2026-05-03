# TweetCheck Backend (Flask)

Simple demo backend for the TweetCheck Chrome extension.

This service:
- extracts a claim from tweet text (OpenAI optional, safe fallback always on)
- searches NewsAPI **only** across a transparent whitelist of news domains
- assigns a three-state corroboration verdict (`corroborated`, `unverified`, `contradicted`)
- adds contextual disclaimers (age, breaking timing, hedged language, no coverage)
- returns data in the existing panel schema used by the extension UI

## 1) Create a virtual environment

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
```

## 2) Install dependencies

```bash
pip install -r requirements.txt
```

## 3) Configure environment

```bash
cp .env.example .env
```

Add your keys in `.env`:
- `NEWS_API_KEY` (required for live news matches)
- `OPENAI_API_KEY` (optional for claim extraction; fallback still works without it)

## 4) Run the server

```bash
python app.py
```

Server default: `http://localhost:5000`

## 5) Test health endpoint

```bash
curl http://localhost:5000/health
```

Expected response:

```json
{"ok":true,"service":"TweetCheck backend"}
```

## 6) Test verify endpoint

```bash
curl -X POST http://localhost:5000/verify \
  -H "Content-Type: application/json" \
  -d '{
    "tweetText": "Breaking: reportedly multiple outlets say a major policy change was announced.",
    "tweetTimestamp": "2026-05-01T12:00:00Z",
    "tweetUrl": "https://x.com/example/status/123"
  }'
```

The response includes:
- `claimSummary`
- `corroboration`
- `disclaimers`
- `aiRisk`
- `traceability`
- `alternatives`
- `debug`

## Notes

- Empty news results mean **"unverified/inconclusive"**, not automatically false.
- The whitelist is a prototype design decision and is intentionally auditable in `whitelist.py`.
- All checker disclaimers are context signals, not true/false judgments.
