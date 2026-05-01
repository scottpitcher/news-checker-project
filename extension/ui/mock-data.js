/**
 * Demo payloads for frontend-only development.
 * Replace with API responses from Flask when backend is ready.
 */
(function () {
  const MOCK_BY_KEYWORD = [
    {
      match: /breaking|just in|developing/i,
      payload: {
        corroboration: "unverified",
        claimSummary: "[Demo] Fast-moving claim; no listed-outlet matches yet.",
        disclaimers: [
          { id: "breaking", text: "Story is brand new—details may change." },
          { id: "tweet_recent", text: "No listed coverage yet; post may be early." },
        ],
        aiRisk: {
          level: "medium",
          headline: "Medium — thin on specifics",
          reasons: [
            "Urgent tone, few concrete names or times.",
            "No links or “according to [outlet].”",
          ],
        },
        traceability: {
          score: 38,
          label: "Limited",
          sourcesFound: 0,
          citationsInTweet: 0,
          entities: [{ type: "topic", name: "Breaking (unspecified)" }],
          notes: ["No URLs or clear “who said this.”", "Short hype posts are harder to verify."],
        },
        alternatives: [
          {
            outlet: "Reuters",
            title: "Breaking news — verify as you read",
            url: "https://www.reuters.com/",
            note: "[Demo] Compare wires, don’t rely on one post.",
          },
          {
            outlet: "Associated Press",
            title: "Latest from AP",
            url: "https://apnews.com/",
            note: "[Demo] Cross-check social-first claims.",
          },
        ],
      },
    },
    {
      match: /false|hoax|debunk|contradict/i,
      payload: {
        corroboration: "contradicted",
        claimSummary: "[Demo] Listed outlets report something different (not a live check).",
        disclaimers: [
          {
            id: "hedged",
            text: "Uses “reportedly” / “unconfirmed”—may not be a firm claim.",
          },
        ],
        aiRisk: {
          level: "high",
          headline: "High — vague “experts say”",
          reasons: [
            "No named expert, paper, or outlet to look up.",
            "Generic wording, almost no dates or agency names.",
          ],
        },
        traceability: {
          score: 22,
          label: "Weak",
          sourcesFound: 0,
          citationsInTweet: 0,
          entities: [],
          notes: ["No path to a primary source.", "Little you could check line by line."],
        },
        alternatives: [
          {
            outlet: "BBC News",
            title: "BBC News",
            url: "https://www.bbc.com/news",
            note: "[Demo] See how majors frame it.",
          },
          {
            outlet: "Reuters Fact Check",
            title: "Fact check hub",
            url: "https://www.reuters.com/fact-check",
            note: "[Demo] For specific claims.",
          },
        ],
      },
    },
  ];

  const DEFAULT_MOCK = {
    corroboration: "corroborated",
    claimSummary: "[Demo] Claim lines up with several listed outlets (sample).",
    disclaimers: [],
    aiRisk: {
      level: "low",
      headline: "Low — more specifics",
      reasons: ["Names places, people, or orgs you can look up.", "Reads like a normal post."],
    },
    traceability: {
      score: 74,
      label: "Strong",
      sourcesFound: 3,
      citationsInTweet: 1,
      entities: [
        { type: "org", name: "Demo Agency" },
        { type: "place", name: "Demo City" },
        { type: "person", name: "Demo Official" },
      ],
      notes: ["Link or clear attribution.", "Concrete hooks to verify."],
    },
    alternatives: [
      {
        outlet: "Reuters",
        title: "[Demo] Wire version",
        url: "https://www.reuters.com/",
        note: "Compare lead and quotes.",
      },
      {
        outlet: "BBC News",
        title: "[Demo] Broadcaster take",
        url: "https://www.bbc.com/news",
        note: "Notice framing vs wire.",
      },
      {
        outlet: "Associated Press",
        title: "[Demo] Another angle",
        url: "https://apnews.com/",
        note: "One source or many?",
      },
    ],
  };

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function pickMock(tweetText) {
    const text = tweetText || "";
    for (const row of MOCK_BY_KEYWORD) {
      if (row.match.test(text)) return clone(row.payload);
    }
    return clone(DEFAULT_MOCK);
  }

  window.TweetCheckMock = { pickMock };
})();
