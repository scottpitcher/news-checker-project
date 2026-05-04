(function () {
  const corroborationCopy = {
    corroborated: { label: "Corroborated", pill: "tc-pill--corroborated" },
    unverified: { label: "Unverified", pill: "tc-pill--unverified" },
    contradicted: { label: "Contradicted", pill: "tc-pill--contradicted" },
  };

  const riskPill = {
    low: "tc-pill--risk-low",
    medium: "tc-pill--risk-medium",
    high: "tc-pill--risk-high",
  };

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  /** Published rules for each rating — keep in sync with backend / product spec. */
  const HOW = {
    corroboration: [
      "We pull out one core factual claim from the post (live: model-assisted; you should be able to audit the text we used).",
      "We only search an allow-list of news domains we publish—not the whole internet—so viral noise does not count as confirmation.",
      "Corroborated: at least two different allow-listed outlets independently support the same core claim (per our match rules).",
      "Unverified: no hit, only one outlet, or not enough agreement yet—it is not a call that the claim is false.",
      "Contradicted: at least one allow-listed outlet reports facts that clearly conflict with the claim.",
      "This panel uses backend lookup results from trusted outlets restricted to the allow list.",
    ],
    quickFlags: [
      "Each flag is a fixed rule on metadata or wording (e.g. post age, how fresh articles are, phrases like “reportedly”).",
      "We log which rule fired; there is no separate AI “true/false” judgment inside this block.",
      "Flags are reminders to read carefully, not verdicts.",
    ],
    aiRisk: [
      "Low, Medium, and High come from writing patterns such as vague authority phrases, missing names, missing dates, and repeated generic wording.",
      "The points under the score explain which signals changed the result for this post.",
      "This is a reading support signal and not proof about authorship.",
      "Production will publish the exact feature weights. Demo mode uses sample levels and sample reasons.",
    ],
    traceability: [
      "The 0–100 score combines signals you can inspect: links in the post, extracted people/places/orgs, clear attribution (“police said…”), and (when live) how many allow-listed articles matched the topic.",
      "Higher means more concrete hooks you could check yourself; lower means thin or vague sourcing.",
      "Bands map to labels like “Strong” or “Limited” using cutoffs we publish with the backend (e.g. in checkers.py).",
      "Numbers are produced by backend scoring from the current post and matched outlet results.",
    ],
    alternatives: [
      "We suggest other pieces from allow-listed outlets on the same topic (live: entity/topic overlap + search, ranked and deduped).",
      "Purpose is cross-checking framing, not picking a single “correct” article.",
      "Links are matched from trusted outlets returned by the backend.",
    ],
  };

  function renderHow(summaryText, bulletPoints) {
    const lis = bulletPoints.map((t) => `<li>${esc(t)}</li>`).join("");
    return `
      <details class="tc-transparency">
        <summary class="tc-transparency__summary">${esc(summaryText)}</summary>
        <div class="tc-transparency__body">
          <ul class="tc-transparency__list">${lis}</ul>
        </div>
      </details>`;
  }

  function renderList(items) {
    if (!items || !items.length) {
      return "<p class=\"tc-footnote\">—</p>";
    }
    const li = items.map((t) => `<li>${esc(t)}</li>`).join("");
    return `<ul class="tc-list">${li}</ul>`;
  }

  function normalizeAiReason(text) {
    if (!text) return "";
    return String(text).replace(/AI-risk/gi, "AI risk").replace(/allow-list/gi, "allow list");
  }

  function renderAiReasons(items) {
    if (!items || !items.length) {
      return "<p class=\"tc-footnote\">No additional AI risk details available.</p>";
    }
    const normalized = items.map((t) => normalizeAiReason(t));
    const li = normalized.map((t) => `<li>${esc(t)}</li>`).join("");
    return `<ul class="tc-list">${li}</ul>`;
  }

  function renderDisclaimers(items) {
    const has = items && items.length;
    const lis = has
      ? items
          .map((d) => `<li>${esc(typeof d === "string" ? d : d.text)}</li>`)
          .join("")
      : "";
    const listBlock = has
      ? `<ul class="tc-disclaimers">${lis}</ul>`
      : `<p class="tc-footnote">No flags for this post—none of our timing/wording rules fired.</p>`;
    return `
      ${renderHow("How we rate quick flags", HOW.quickFlags)}
      ${listBlock}`;
  }

  function renderEntities(entities) {
    if (!entities || !entities.length) {
      return "<p class=\"tc-footnote\">No names extracted.</p>";
    }
    const tags = entities
      .map(
        (e) =>
          `<span class="tc-tag" title="${esc(e.type)}">${esc(e.name)}</span>`
      )
      .join("");
    return `<div class="tc-entity-tags">${tags}</div>`;
  }

  function renderAlternatives(alts) {
    if (!alts || !alts.length) {
      return "<p class=\"tc-footnote\">No links yet.</p>";
    }
    return alts
      .map(
        (a) => `
      <a class="tc-alt" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">
        <div class="tc-alt__outlet">${esc(a.outlet)}</div>
        <div class="tc-alt__title">${esc(a.title)}</div>
        <div class="tc-alt__note">${esc(a.note || "")}</div>
      </a>`
      )
      .join("");
  }

  function renderCorroborationOutlets(data) {
    const outlets = Array.from(
      new Set(
        (data.alternatives || [])
          .map((item) => (item?.outlet || "").trim())
          .filter(Boolean)
      )
    );

    if (!outlets.length) {
      return "<p class=\"tc-footnote\">No outlet matches found yet.</p>";
    }

    const li = outlets.map((name) => `<li>${esc(name)}</li>`).join("");
    return `<ul class="tc-list">${li}</ul>`;
  }

  function formatTweetTime(iso) {
    if (!iso) return "";
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  }

  function render(data, context = {}) {
    const cor = corroborationCopy[data.corroboration] || corroborationCopy.unverified;
    const riskClass = riskPill[data.aiRisk?.level] || riskPill.medium;
    const score = Math.max(0, Math.min(100, Number(data.traceability?.score) || 0));
    const tweetText = (context.tweetText || "").trim();
    const tweetTime = formatTweetTime(context.tweetTime);
    const tweetAuthor = (context.tweetAuthor || "").trim();
    const hasVideo = Boolean(context.hasVideo);
    const tweetPreview = tweetText || "No tweet text available.";

    const root = document.getElementById("tc-root");
    if (!root) return;

    root.innerHTML = `
      <div class="tc-panel">
        <header class="tc-panel__header">
          <div>
            <h1 class="tc-panel__title">TweetCheck</h1>
            <p class="tc-panel__subtitle">Quick read for this post.</p>
          </div>
          <button type="button" class="tc-panel__close" id="tc-close" aria-label="Close panel">×</button>
        </header>
        <div class="tc-panel__body">
          <div class="tc-card">
            <div class="tc-card__head">
              <h2 class="tc-card__title">Post being checked</h2>
            </div>
            <p class="tc-quote">${esc(tweetPreview)}</p>
            ${tweetAuthor ? `<p class="tc-footnote">Posted by: <strong>${esc(tweetAuthor)}</strong></p>` : ""}
            ${tweetTime ? `<p class="tc-footnote">Posted: ${esc(tweetTime)}</p>` : ""}
            ${hasVideo ? `<p class="tc-footnote tc-footnote--notice">Video detected. This check uses post text only and does not analyze video audio or frames.</p>` : ""}
          </div>

          <div class="tc-card">
            <div class="tc-card__head">
              <h2 class="tc-card__title">Corroboration</h2>
              <span class="tc-pill ${cor.pill}">${esc(cor.label)}</span>
            </div>
            ${renderHow("How we rate corroboration", HOW.corroboration)}
            <p class="tc-claim">${esc(data.claimSummary || "")}</p>
            <p class="tc-footnote"><strong>Matched outlets</strong></p>
            ${renderCorroborationOutlets(data)}
          </div>

          <div class="tc-card">
            <div class="tc-card__head">
              <h2 class="tc-card__title">AI generation risk</h2>
              <span class="tc-pill ${riskClass}">${esc((data.aiRisk?.level || "medium").toUpperCase())}</span>
            </div>
            ${renderHow("How we rate AI generation risk", HOW.aiRisk)}
            <p class="tc-claim" style="font-size:0.9rem">${esc(data.aiRisk?.headline || "Risk signal")}</p>
            <p class="tc-footnote">This score reflects language patterns and sourcing cues in the post text.</p>
            ${renderAiReasons(data.aiRisk?.reasons)}
          </div>

          <div class="tc-card">
            <div class="tc-card__head">
              <h2 class="tc-card__title">Source traceability</h2>
              <span class="tc-pill tc-pill--corroborated" style="text-transform:none;letter-spacing:0">${esc(data.traceability?.label || "Score")}</span>
            </div>
            ${renderHow("How we rate source traceability", HOW.traceability)}
            <div class="tc-meter">
              <div class="tc-meter__track">
                <div class="tc-meter__fill" style="width:${score}%"></div>
              </div>
              <div class="tc-meter__meta">
                <span>0–100</span>
                <span><strong>${score}</strong></span>
              </div>
            </div>
            <p class="tc-footnote" style="margin-top:10px">
              Links in post: <strong>${esc(data.traceability?.citationsInTweet ?? 0)}</strong> · Listed outlets matched: <strong>${esc(data.traceability?.sourcesFound ?? 0)}</strong>
            </p>
            ${renderEntities(data.traceability?.entities)}
            ${renderList(data.traceability?.notes)}
          </div>

          <div class="tc-card">
            <div class="tc-card__head">
              <h2 class="tc-card__title">Credible alternatives</h2>
            </div>
            ${renderHow("How we pick credible alternatives", HOW.alternatives)}
            <div class="tc-alt-list">
              ${renderAlternatives(data.alternatives)}
            </div>
          </div>

          <details class="tc-card tc-card--collapsible">
            <summary class="tc-card__summary">
              <span class="tc-card__title">Quick flags</span>
            </summary>
            <div class="tc-card__content">
              ${renderDisclaimers(data.disclaimers)}
            </div>
          </details>
        </div>
      </div>
    `;

    document.getElementById("tc-close")?.addEventListener("click", () => {
      window.parent.postMessage({ type: "TWEETCHECK_CLOSE" }, "*");
    });
  }

  window.renderTweetCheck = render;

  window.addEventListener("message", (ev) => {
    if (!ev.data || ev.data.type !== "TWEETCHECK_RENDER") return;
    const payload = ev.data.payload || {};
    render(payload, {
      tweetText: ev.data.tweetText,
      tweetTime: ev.data.tweetTime,
      tweetUrl: ev.data.tweetUrl,
      tweetAuthor: ev.data.tweetAuthor,
      hasVideo: ev.data.hasVideo,
    });
  });

})();
