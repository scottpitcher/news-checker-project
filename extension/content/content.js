(() => {
  const PROCESSED = new WeakSet();
  const BTN_CLASS = "tweetcheck-btn";
  const VERIFY_URL = "http://localhost:5000/verify";
  const REQUEST_TIMEOUT_MS = 9000;

  function getTweetRoot(el) {
    return el?.closest?.('article[data-testid="tweet"]') ?? null;
  }

  function extractTweetText(article) {
    if (!article) return "";
    const textEl = article.querySelector('[data-testid="tweetText"]');
    if (textEl) return textEl.innerText.trim();
    const legacy = article.querySelector('[lang]');
    return legacy ? legacy.innerText.trim() : "";
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

    return {
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
  }

  function postRenderMessage(iframe, message) {
    iframe?.contentWindow?.postMessage(message, "*");
  }

  async function fetchVerifyPayload(tweetText, tweetTime, tweetUrl) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tweetText: tweetText || "",
          tweetTimestamp: tweetTime || null,
          tweetUrl: tweetUrl || location.href,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }
      const payload = await response.json();
      return normalizePayload(payload, tweetText);
    } finally {
      clearTimeout(timer);
    }
  }

  async function renderWithBackendOrMock(iframe, tweetText, tweetTime, tweetUrl) {
    postRenderMessage(iframe, {
      type: "TWEETCHECK_RENDER",
      useMock: false,
      tweetText,
      tweetTime,
      payload: buildLoadingPayload(tweetText),
    });

    try {
      const payload = await fetchVerifyPayload(tweetText, tweetTime, tweetUrl);
      postRenderMessage(iframe, {
        type: "TWEETCHECK_RENDER",
        useMock: false,
        tweetText,
        tweetTime,
        payload,
      });
    } catch (err) {
      // Safe fallback: keep existing demo behavior if backend is offline or invalid.
      postRenderMessage(iframe, {
        type: "TWEETCHECK_RENDER",
        useMock: true,
        tweetText,
        tweetTime,
        payload: null,
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

  function openPanel(tweetText, tweetTime, tweetUrl) {
    const overlay = ensureOverlay();
    const iframe = overlay.querySelector("iframe");
    const url = new URL(chrome.runtime.getURL("ui/panel.html"));
    url.searchParams.set("v", String(Date.now()));

    overlay.classList.add("is-open");
    iframe.src = url.toString();

    const onLoad = () => {
      iframe.removeEventListener("load", onLoad);
      renderWithBackendOrMock(iframe, tweetText, tweetTime, tweetUrl);
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
      openPanel(text, time, tweetUrl);
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
