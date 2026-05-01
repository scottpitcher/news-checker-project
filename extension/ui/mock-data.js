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
        claimSummary:
          "[Demo] Main factual claim we pulled from the post: a fast-moving story with little or no matching coverage from allow-listed outlets yet.",
        disclaimers: [
          {
            id: "breaking",
            text: "News about this claim is very new. Details often change in the first hours—check again later.",
          },
          {
            id: "tweet_recent",
            text: "We did not find matching allow-listed coverage yet. The post may simply be ahead of major outlets.",
          },
        ],
        aiRisk: {
          level: "medium",
          headline: "Medium risk — writing looks rushed or thin",
          reasons: [
            "Sounds urgent but does not name many specific people, places, agencies, or times.",
            "No links and no “according to [named outlet]” line, so it is harder to verify yourself.",
          ],
        },
        traceability: {
          score: 38,
          label: "Limited traceability",
          sourcesFound: 0,
          citationsInTweet: 0,
          entities: [{ type: "topic", name: "Breaking news (topic not specified)" }],
          notes: [
            "We did not find URLs or clear attribution (“police said,” “the agency reported”) in the text.",
            "One short, loud sentence without sources is usually harder to check than a report with names and links.",
          ],
        },
        alternatives: [
          {
            outlet: "Reuters",
            title: "How to verify breaking news as it unfolds",
            url: "https://www.reuters.com/",
            note: "[Demo link] Wire services often publish first; still compare more than one trusted source.",
          },
          {
            outlet: "Associated Press",
            title: "AP News — latest headlines",
            url: "https://apnews.com/",
            note: "[Demo link] Useful to contrast with what you see first on social feeds.",
          },
        ],
      },
    },
    {
      match: /false|hoax|debunk|contradict/i,
      payload: {
        corroboration: "contradicted",
        claimSummary:
          "[Demo] The claim in this post does not line up with what several allow-listed outlets are reporting (sample only—not a live check).",
        disclaimers: [
          {
            id: "hedged",
            text: "The post uses words like “reportedly” or “unconfirmed.” The author may not be stating a finished fact.",
          },
        ],
        aiRisk: {
          level: "high",
          headline: "Higher risk — vague authority and generic phrasing",
          reasons: [
            "Leans on “experts say” without naming a person, study, or publication you could look up.",
            "Very even, generic wording and almost no concrete dates, agencies, or document names.",
          ],
        },
        traceability: {
          score: 22,
          label: "Poor traceability",
          sourcesFound: 0,
          citationsInTweet: 0,
          entities: [],
          notes: [
            "Hard to trace: no clear chain from this text to a primary source you can open and read.",
            "Compared with typical wire or investigative pieces, there is little here you could fact-check step by step.",
          ],
        },
        alternatives: [
          {
            outlet: "BBC News",
            title: "BBC News home (demo link)",
            url: "https://www.bbc.com/news",
            note: "[Demo] Compare how a major outlet words the story and what it cites.",
          },
          {
            outlet: "Reuters Fact Check",
            title: "Reuters Fact Check hub",
            url: "https://www.reuters.com/fact-check",
            note: "[Demo] Useful when you want to verify a specific claim, not just read headlines.",
          },
        ],
      },
    },
  ];

  const DEFAULT_MOCK = {
    corroboration: "corroborated",
    claimSummary:
      "[Demo] The main claim matches the kind of story several allow-listed outlets are also covering (sample data—not a live search).",
    disclaimers: [],
    aiRisk: {
      level: "low",
      headline: "Lower risk — more concrete detail than average",
      reasons: [
        "Includes specific names of people, places, or organizations you could look up.",
        "Reads like a normal human post: uneven length and ordinary wording.",
      ],
    },
    traceability: {
      score: 74,
      label: "Strong traceability",
      sourcesFound: 3,
      citationsInTweet: 1,
      entities: [
        { type: "org", name: "Demo Agency" },
        { type: "place", name: "Demo City" },
        { type: "person", name: "Demo Official" },
      ],
      notes: [
        "We see at least one link or a clear line about who said what.",
        "Named people, places, and organizations give you obvious starting points to verify against allow-listed coverage.",
      ],
    },
    alternatives: [
      {
        outlet: "Reuters",
        title: "[Demo] Wire-style write-up of the same event",
        url: "https://www.reuters.com/",
        note: "Compare the first paragraph and who gets quoted.",
      },
      {
        outlet: "BBC News",
        title: "[Demo] Broadcaster summary of the same story",
        url: "https://www.bbc.com/news",
        note: "Notice different emphasis or context even when facts overlap.",
      },
      {
        outlet: "Associated Press",
        title: "[Demo] Another allow-listed angle on the same topic",
        url: "https://apnews.com/",
        note: "See whether more than one outlet did original reporting or they all cite the same wire.",
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
