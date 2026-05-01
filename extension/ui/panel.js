/* global TweetCheckMock */

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
      "Right now this panel uses placeholder results; production will run this against NewsAPI (or similar) restricted to the allow-list.",
    ],
    quickFlags: [
      "Each flag is a fixed rule on metadata or wording (e.g. post age, how fresh articles are, phrases like “reportedly”).",
      "We log which rule fired; there is no separate AI “true/false” judgment inside this block.",
      "Flags are reminders to read carefully, not verdicts.",
    ],
    aiRisk: [
      "Low / Medium / High is a heuristic from writing patterns: vague authority (“experts say”), missing names/dates/places, repetition, very even tone, etc.",
      "The bullets under the label list the patterns that moved the score for this post.",
      "We do not run forensic “did a model write this?” proof; treat this as a reading aid only.",
      "Production will document exact feature weights; the demo uses sample levels and reasons.",
    ],
    traceability: [
      "The 0–100 score combines signals you can inspect: links in the post, extracted people/places/orgs, clear attribution (“police said…”), and (when live) how many allow-listed articles matched the topic.",
      "Higher means more concrete hooks you could check yourself; lower means thin or vague sourcing.",
      "Bands map to labels like “Strong” or “Limited” using cutoffs we publish with the backend (e.g. in checkers.py).",
      "Numbers in this demo are illustrative until the server computes them from real inputs.",
    ],
    alternatives: [
      "We suggest other pieces from allow-listed outlets on the same topic (live: entity/topic overlap + search, ranked and deduped).",
      "Purpose is cross-checking framing, not picking a single “correct” article.",
      "Links shown here are demo placeholders; production will replace them with real matches.",
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
      <div class="tc-card">
        <div class="tc-card__head">
          <h2 class="tc-card__title">Quick flags</h2>
        </div>
        <p class="tc-section-intro">Timing and wording heads-up—not a true/false call.</p>
        ${renderHow("How we rate quick flags", HOW.quickFlags)}
        ${listBlock}
      </div>`;
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

  function render(data) {
    const cor = corroborationCopy[data.corroboration] || corroborationCopy.unverified;
    const riskClass = riskPill[data.aiRisk?.level] || riskPill.medium;
    const score = Math.max(0, Math.min(100, Number(data.traceability?.score) || 0));

    const root = document.getElementById("tc-root");
    if (!root) return;

    root.innerHTML = `
      <div class="tc-panel">
        <header class="tc-panel__header">
          <div>
            <h1 class="tc-panel__title">TweetCheck</h1>
            <p class="tc-panel__subtitle">Trusted outlets, how verifiable the post is, AI-style cues, related reads. <strong>Demo data</strong> until backend is on.</p>
          </div>
          <button type="button" class="tc-panel__close" id="tc-close" aria-label="Close panel">×</button>
        </header>
        <div class="tc-panel__body">
          <div class="tc-banner">
            <strong>Demo</strong> — not a live fact-check.
            Open <strong>How we rate…</strong> under each section for the exact rules behind every label.
          </div>

          <div class="tc-card">
            <div class="tc-card__head">
              <h2 class="tc-card__title">Corroboration</h2>
              <span class="tc-pill ${cor.pill}">${esc(cor.label)}</span>
            </div>
            <p class="tc-section-intro">Checked against a <strong>fixed list</strong> of trusted outlets—not the whole internet.</p>
            ${renderHow("How we rate corroboration", HOW.corroboration)}
            <p class="tc-claim">${esc(data.claimSummary || "")}</p>
            <p class="tc-footnote">Not “true/false”—only whether listed outlets <em>match</em>, <em>haven’t covered it yet</em>, or <em>disagree</em>.</p>
          </div>

          ${renderDisclaimers(data.disclaimers)}

          <div class="tc-card">
            <div class="tc-card__head">
              <h2 class="tc-card__title">AI-generation risk</h2>
              <span class="tc-pill ${riskClass}">${esc((data.aiRisk?.level || "medium").toUpperCase())}</span>
            </div>
            <p class="tc-section-intro">Style cue only—not proof a bot wrote this.</p>
            ${renderHow("How we rate AI-generation risk", HOW.aiRisk)}
            <p class="tc-claim" style="font-size:0.9rem">${esc(data.aiRisk?.headline || "Risk signal")}</p>
            ${renderList(data.aiRisk?.reasons)}
          </div>

          <div class="tc-card">
            <div class="tc-card__head">
              <h2 class="tc-card__title">Source traceability</h2>
              <span class="tc-pill tc-pill--corroborated" style="text-transform:none;letter-spacing:0">${esc(data.traceability?.label || "Score")}</span>
            </div>
            <p class="tc-section-intro">Higher = easier to verify (names, links, who said what).</p>
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
            <p class="tc-section-intro" style="margin-bottom:8px">Same topic, other trusted outlets—compare the angle.</p>
            ${renderHow("How we pick credible alternatives", HOW.alternatives)}
            <div class="tc-alt-list">
              ${renderAlternatives(data.alternatives)}
            </div>
          </div>
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
    let payload = ev.data.payload;
    if (ev.data.useMock && window.TweetCheckMock) {
      payload = TweetCheckMock.pickMock(ev.data.tweetText || "");
    }
    render(payload);
  });

  const params = new URLSearchParams(window.location.search);
  if (params.get("demo") === "1" && window.TweetCheckMock) {
    render(TweetCheckMock.pickMock("Demo default corroborated story."));
  }
})();
