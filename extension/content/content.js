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
    return legacy ? legacy.innerText.trim() : "";
  }

  function extractTweetTime(article) {
    if (!article) return null;
    const t = article.querySelector("time[datetime]");
    return t ? t.getAttribute("datetime") : null;
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

  function openPanel(tweetText, tweetTime) {
    const overlay = ensureOverlay();
    const iframe = overlay.querySelector("iframe");
    const url = new URL(chrome.runtime.getURL("ui/panel.html"));
    url.searchParams.set("v", String(Date.now()));

    overlay.classList.add("is-open");
    iframe.src = url.toString();

    const onLoad = () => {
      iframe.removeEventListener("load", onLoad);
      iframe.contentWindow?.postMessage(
        {
          type: "TWEETCHECK_RENDER",
          useMock: true,
          tweetText,
          tweetTime,
          payload: null,
        },
        "*"
      );
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
      openPanel(text, time);
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
