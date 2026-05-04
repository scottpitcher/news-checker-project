(() => {
  const PROCESSED = new WeakSet();
  const BTN_CLASS = "tweetcheck-btn";
  function getTweetRoot(el) {
    return el?.closest?.('article[data-testid="tweet"]') ?? null;
  }

  function extractTweetText(article) {
    if (!article) return "";
    const textEl = article.querySelector('[data-testid="tweetText"]');
    if (textEl) return textEl.innerText.trim();
    const legacy = article.querySelector('[lang]');
    if (legacy) return legacy.innerText.trim();

    const textBits = Array.from(article.querySelectorAll("div[lang], span[lang], span[dir='auto']"))
      .map((el) => (el.innerText || "").trim())
      .filter(Boolean);
    if (textBits.length) return textBits.join(" ").replace(/\s+/g, " ").trim();

    const full = (article.innerText || "").replace(/\s+/g, " ").trim();
    return full.slice(0, 400);
  }

  function extractTweetTime(article) {
    if (!article) return null;
    const t = article.querySelector("time[datetime]");
    return t ? t.getAttribute("datetime") : null;
  }

  function extractTweetUrl(article) {
    if (!article) return location.href;
    const statusLink = article.querySelector('a[href*="/status/"]');
    if (!statusLink) return location.href;
    const href = statusLink.getAttribute("href");
    if (!href) return location.href;
    try {
      return new URL(href, location.origin).toString();
    } catch {
      return location.href;
    }
  }

  function extractTweetAuthor(article) {
    if (!article) return "";
    const userLink = article.querySelector('a[role="link"][href^="/"][href*="/status/"]');
    if (userLink) {
      const href = userLink.getAttribute("href") || "";
      const parts = href.split("/").filter(Boolean);
      if (parts.length) return `@${parts[0]}`;
    }

    const nameBlock = article.querySelector('[data-testid="User-Name"]');
    if (!nameBlock) return "";
    const handleEl = nameBlock.querySelector("a[href^='/']");
    if (!handleEl) return "";
    const handle = (handleEl.textContent || "").trim();
    return handle.startsWith("@") ? handle : handle ? `@${handle}` : "";
  }

  function deriveAuthorFromUrl(tweetUrl) {
    if (!tweetUrl) return "";
    try {
      const url = new URL(tweetUrl);
      const parts = url.pathname.split("/").filter(Boolean);
      if (!parts.length) return "";
      return `@${parts[0]}`;
    } catch {
      return "";
    }
  }

  function hasVideoMedia(article) {
    if (!article) return false;
    if (article.querySelector("video")) return true;
    if (article.querySelector('[data-testid="videoComponent"]')) return true;
    if (article.querySelector('[aria-label*="video" i]')) return true;
    return false;
  }

  function buildLoadingPayload(tweetText) {
    return {
      claimSummary: "Checking this post against TweetCheck backend...",
      corroboration: "unverified",
      disclaimers: [],
      aiRisk: {
        level: "medium",
        headline: "Running verification",
        reasons: ["Searching whitelisted outlets and contextual checkers."],
      },
      traceability: {
        score: 0,
        label: "Limited",
        sourcesFound: 0,
        citationsInTweet: 0,
        entities: [],
        notes: [tweetText ? "Processing selected tweet text." : "Processing post text."],
      },
      alternatives: [],
    };
  }

  function buildBackendErrorPayload(tweetText, detail) {
    const reason = detail || "No local backend endpoint responded.";
    return {
      claimSummary: tweetText || "Could not load backend analysis for this post.",
      corroboration: "unverified",
      disclaimers: [],
      aiRisk: {
        level: "medium",
        headline: "Backend unavailable",
        reasons: [
          "TweetCheck could not reach your local backend service.",
          reason,
        ],
      },
      traceability: {
        score: 0,
        label: "Unavailable",
        sourcesFound: 0,
        citationsInTweet: 0,
        entities: [],
        notes: ["Start the backend service, then try this post again."],
      },
      alternatives: [],
      debug: {
        backendError: true,
      },
    };
  }

  function normalizeEntities(entities) {
    if (!Array.isArray(entities)) return [];
    return entities
      .map((item) => {
        if (typeof item === "string") {
          return { type: "entity", name: item };
        }
        if (item && typeof item === "object") {
          return { type: item.type || "entity", name: item.name || String(item) };
        }
        return null;
      })
      .filter((item) => item && item.name);
  }

  function normalizePayload(raw, fallbackTweetText) {
    const safe = raw && typeof raw === "object" ? raw : {};
    const aiRisk = safe.aiRisk && typeof safe.aiRisk === "object" ? safe.aiRisk : {};
    const traceability = safe.traceability && typeof safe.traceability === "object" ? safe.traceability : {};
    const alternatives = Array.isArray(safe.alternatives) ? safe.alternatives : [];
    const disclaimers = Array.isArray(safe.disclaimers) ? safe.disclaimers : [];
    const allowedCorroboration = new Set(["corroborated", "unverified", "contradicted"]);

    const normalized = {
      claimSummary:
        typeof safe.claimSummary === "string" && safe.claimSummary.trim()
          ? safe.claimSummary
          : (fallbackTweetText || "No claim summary available."),
      corroboration: allowedCorroboration.has(safe.corroboration) ? safe.corroboration : "unverified",
      disclaimers,
      aiRisk: {
        level: ["low", "medium", "high"].includes(aiRisk.level) ? aiRisk.level : "medium",
        headline: aiRisk.headline || "No AI-risk summary available.",
        reasons: Array.isArray(aiRisk.reasons) ? aiRisk.reasons : [],
      },
      traceability: {
        score: Number.isFinite(Number(traceability.score)) ? Number(traceability.score) : 0,
        label: traceability.label || "Limited",
        sourcesFound: Number.isFinite(Number(traceability.sourcesFound))
          ? Number(traceability.sourcesFound)
          : 0,
        citationsInTweet: Number.isFinite(Number(traceability.citationsInTweet))
          ? Number(traceability.citationsInTweet)
          : 0,
        entities: normalizeEntities(traceability.entities),
        notes: Array.isArray(traceability.notes) ? traceability.notes : [],
      },
      alternatives: alternatives
        .filter((row) => row && typeof row === "object")
        .map((row) => ({
          outlet: row.outlet || "Whitelisted outlet",
          title: row.title || "Related coverage",
          url: row.url || "#",
          note: row.note || "",
        })),
      debug: safe.debug || {},
    };

    return normalized;
  }

  function postRenderMessage(iframe, message) {
    iframe?.contentWindow?.postMessage(message, "*");
  }

  async function fetchVerifyPayload(tweetText, tweetTime, tweetUrl, tweetAuthor) {
    const response = await chrome.runtime.sendMessage({
      type: "TWEETCHECK_VERIFY",
      payload: {
        tweetText: tweetText || "",
        tweetTimestamp: tweetTime || null,
        tweetUrl: tweetUrl || location.href,
        tweetAuthor: tweetAuthor || "",
      },
    });

    if (!response?.ok) {
      throw new Error(response?.error || "No backend response.");
    }

    return normalizePayload(response.payload, tweetText);
  }

  async function renderWithBackend(iframe, tweetText, tweetTime, tweetUrl, tweetAuthor, hasVideo) {
    postRenderMessage(iframe, {
      type: "TWEETCHECK_RENDER",
      tweetText,
      tweetTime,
      tweetUrl,
      tweetAuthor,
      hasVideo,
      payload: buildLoadingPayload(tweetText),
    });

    try {
      const payload = await fetchVerifyPayload(tweetText, tweetTime, tweetUrl, tweetAuthor);
      postRenderMessage(iframe, {
        type: "TWEETCHECK_RENDER",
        tweetText,
        tweetTime,
        tweetUrl,
        tweetAuthor,
        hasVideo,
        payload,
      });
    } catch (err) {
      postRenderMessage(iframe, {
        type: "TWEETCHECK_RENDER",
        tweetText,
        tweetTime,
        tweetUrl,
        tweetAuthor,
        hasVideo,
        payload: buildBackendErrorPayload(tweetText, err?.message || ""),
      });
    }
  }

  function ensureOverlay() {
    let overlay = document.getElementById("tweetcheck-overlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "tweetcheck-overlay";
    overlay.innerHTML = `
      <div class="tweetcheck-backdrop" data-tweetcheck-close></div>
      <div class="tweetcheck-sheet" role="dialog" aria-label="TweetCheck analysis">
        <iframe title="TweetCheck panel" src="" sandbox="allow-scripts allow-same-origin"></iframe>
      </div>
    `;
    document.documentElement.appendChild(overlay);

    overlay.addEventListener("click", (e) => {
      if (e.target?.hasAttribute?.("data-tweetcheck-close")) closeOverlay();
    });

    window.addEventListener("message", (ev) => {
      if (ev.data?.type === "TWEETCHECK_CLOSE") closeOverlay();
    });

    return overlay;
  }

  function closeOverlay() {
    const overlay = document.getElementById("tweetcheck-overlay");
    if (!overlay) return;
    overlay.classList.remove("is-open");
    const iframe = overlay.querySelector("iframe");
    if (iframe) iframe.src = "about:blank";
  }

  function openPanel(tweetText, tweetTime, tweetUrl, tweetAuthor, hasVideo) {
    const overlay = ensureOverlay();
    const iframe = overlay.querySelector("iframe");
    const url = new URL(chrome.runtime.getURL("ui/panel.html"));
    url.searchParams.set("v", String(Date.now()));

    overlay.classList.add("is-open");
    iframe.src = url.toString();

    const onLoad = () => {
      iframe.removeEventListener("load", onLoad);
      renderWithBackend(iframe, tweetText, tweetTime, tweetUrl, tweetAuthor, hasVideo);
    };
    iframe.addEventListener("load", onLoad);
  }

  function findActionRow(article) {
    const group = article.querySelector('[role="group"]');
    if (group) return { row: group, insertParent: group.parentElement, before: group.nextSibling };

    const reply = article.querySelector('[data-testid="reply"]');
    if (reply) {
      const row = reply.closest('[role="group"]') || reply.closest("div");
      if (row?.parentElement) {
        return { row, insertParent: row.parentElement, before: row.nextSibling };
      }
    }

    const textBlock = article.querySelector('[data-testid="tweetText"]');
    if (textBlock) {
      const cell = textBlock.closest("div");
      if (cell?.parentElement) {
        return { row: null, insertParent: cell.parentElement, before: cell.nextSibling };
      }
    }

    return null;
  }

  function attachToArticle(article) {
    if (!article || PROCESSED.has(article)) return;
    const placement = findActionRow(article);
    if (!placement?.insertParent) return;

    PROCESSED.add(article);

    const wrap = document.createElement("div");
    wrap.className = "tweetcheck-anchor";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = BTN_CLASS;
    btn.innerHTML = '<span class="tweetcheck-btn__dot" aria-hidden="true"></span><span>TweetCheck</span>';

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const text = extractTweetText(article);
      const time = extractTweetTime(article);
      const tweetUrl = extractTweetUrl(article);
      const tweetAuthor = extractTweetAuthor(article) || deriveAuthorFromUrl(tweetUrl);
      const hasVideo = hasVideoMedia(article);
      openPanel(text, time, tweetUrl, tweetAuthor, hasVideo);
    });

    wrap.appendChild(btn);
    placement.insertParent.insertBefore(wrap, placement.before);
  }

  function scan() {
    document.querySelectorAll('article[data-testid="tweet"]').forEach(attachToArticle);
  }

  const observer = new MutationObserver(() => {
    scan();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  scan();
})();
