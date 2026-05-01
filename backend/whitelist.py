"""TweetCheck outlet whitelist.

This list is intentionally explicit and easy to audit.
It is a prototype and not a claim of perfect neutrality.
"""

WHITELISTED_OUTLETS = [
    {
        "name": "Reuters",
        "domain": "reuters.com",
        "region": "Global",
        "type": "news",
        "family": "Reuters",
        "notes": "International wire service.",
    },
    {
        "name": "Associated Press",
        "domain": "apnews.com",
        "region": "United States",
        "type": "news",
        "family": "Associated Press",
        "notes": "International wire service.",
    },
    {
        "name": "BBC News",
        "domain": "bbc.com",
        "region": "United Kingdom",
        "type": "news",
        "family": "BBC",
        "notes": "Public service broadcaster.",
    },
    {
        "name": "NPR",
        "domain": "npr.org",
        "region": "United States",
        "type": "news",
        "family": "NPR",
        "notes": "Public media organization.",
    },
    {
        "name": "PBS",
        "domain": "pbs.org",
        "region": "United States",
        "type": "news",
        "family": "PBS",
        "notes": "Public media organization.",
    },
    {
        "name": "The Guardian",
        "domain": "theguardian.com",
        "region": "United Kingdom",
        "type": "news",
        "family": "The Guardian",
        "notes": "International newspaper and digital outlet.",
    },
    {
        "name": "Al Jazeera",
        "domain": "aljazeera.com",
        "region": "Qatar / Global",
        "type": "news",
        "family": "Al Jazeera",
        "notes": "International broadcaster.",
    },
    {
        "name": "Financial Times",
        "domain": "ft.com",
        "region": "United Kingdom",
        "type": "news",
        "family": "Financial Times",
        "notes": "Global business publication.",
    },
    {
        "name": "ABC News",
        "domain": "abcnews.go.com",
        "region": "United States",
        "type": "news",
        "family": "ABC",
        "notes": "Broadcast and digital newsroom.",
    },
    {
        "name": "CBS News",
        "domain": "cbsnews.com",
        "region": "United States",
        "type": "news",
        "family": "CBS",
        "notes": "Broadcast and digital newsroom.",
    },
    {
        "name": "NBC News",
        "domain": "nbcnews.com",
        "region": "United States",
        "type": "news",
        "family": "NBC",
        "notes": "Broadcast and digital newsroom.",
    },
    {
        "name": "CNN",
        "domain": "cnn.com",
        "region": "United States",
        "type": "news",
        "family": "CNN",
        "notes": "Cable and digital newsroom.",
    },
]

WHITELISTED_DOMAINS = [row["domain"] for row in WHITELISTED_OUTLETS]

DOMAIN_TO_OUTLET = {row["domain"]: row for row in WHITELISTED_OUTLETS}
