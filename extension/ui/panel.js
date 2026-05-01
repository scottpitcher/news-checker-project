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

  function renderList(items) {
    if (!items || !items.length) {
      return "<p class=\"tc-footnote\">Nothing to show in this section for this demo.</p>";
    }
    const li = items.map((t) => `<li>${esc(t)}</li>`).join("");
    return `<ul class="tc-list">${li}</ul>`;
  }

  function renderDisclaimers(items) {
    if (!items || !items.length) return "";
    const lis = items
      .map((d) => `<li>${esc(typeof d === "string" ? d : d.text)}</li>`)
      .join("");
    return `
      <div class="tc-card">
        <div class="tc-card__head">
          <h2 class="tc-card__title">Contextual checkers</h2>
        </div>
        <p class="tc-section-intro">
          Short warnings based on simple rules: how old the post is, how fresh the news is, vague wording, and similar.
          These are <strong>not</strong> automated “true or false” judgments.
        </p>
        <ul class="tc-disclaimers">${lis}</ul>
      </div>`;
  }

  function renderEntities(entities) {
    if (!entities || !entities.length) {
      return "<p class=\"tc-footnote\">No people, places, or organizations were extracted in this demo.</p>";
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
      return "<p class=\"tc-footnote\">No suggested trusted articles in this demo.</p>";
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
            <p class="tc-panel__subtitle">
              Compares the claim to a <strong>fixed list of trusted news sites</strong> (not the whole internet), estimates how easy the post is to verify,
              highlights writing that often feels machine-generated, and suggests other trusted coverage.
              <strong>What you see here is sample data</strong> until your server supplies real results.
            </p>
          </div>
          <button type="button" class="tc-panel__close" id="tc-close" aria-label="Close panel">×</button>
        </header>
        <div class="tc-panel__body">
          <div class="tc-banner">
            <strong>Sample data only.</strong> These labels, scores, and links are filled in to preview the design.
            They are <strong>not</strong> live fact-checks.
            <span class="tc-banner__note">
              For developers: replace this by sending JSON from your backend (for example a Flask app) and calling
              <code>renderTweetCheck</code> through <code>postMessage</code> on the panel iframe.
            </span>
          </div>

          <div class="tc-card">
            <div class="tc-card__head">
              <h2 class="tc-card__title">Corroboration</h2>
              <span class="tc-pill ${cor.pill}">${esc(cor.label)}</span>
            </div>
            <p class="tc-section-intro">
              We only search an <strong>allow-list</strong> of news organizations we treat as credible (for example from NewsGuard-style ratings).
              We do <strong>not</strong> search the open web, so a rumor repeated on many random sites will not automatically look “confirmed.”
            </p>
            <p class="tc-claim">${esc(data.claimSummary || "")}</p>
            <p class="tc-footnote">
              <strong>Corroborated / Unverified / Contradicted</strong> does <strong>not</strong> mean “true” or “false.”
              It only describes whether allow-listed outlets <em>agree</em>, <em>have not yet reported something useful</em>, or <em>conflict</em> with the claim.
            </p>
          </div>

          ${renderDisclaimers(data.disclaimers)}

          <div class="tc-card">
            <div class="tc-card__head">
              <h2 class="tc-card__title">AI-generation risk</h2>
              <span class="tc-pill ${riskClass}">${esc((data.aiRisk?.level || "medium").toUpperCase())}</span>
            </div>
            <p class="tc-section-intro">
              A <strong>rough signal</strong> from wording and structure (repetition, vagueness, missing specifics).
              It helps you notice “something feels off”—it is <strong>not</strong> proof that a person or a chatbot wrote the post.
            </p>
            <p class="tc-claim" style="font-size:0.9rem">${esc(data.aiRisk?.headline || "Risk signal")}</p>
            ${renderList(data.aiRisk?.reasons)}
            <p class="tc-footnote">Use this to read more carefully, not to accuse someone of using AI.</p>
          </div>

          <div class="tc-card">
            <div class="tc-card__head">
              <h2 class="tc-card__title">Source traceability</h2>
              <span class="tc-pill tc-pill--corroborated" style="text-transform:none;letter-spacing:0">${esc(data.traceability?.label || "Score")}</span>
            </div>
            <p class="tc-section-intro">
              How easy is it to <strong>track this post back to checkable facts</strong>?
              A higher score means more concrete hooks (named people, agencies, places, links, clear “who said this”).
              A lower score means vague claims that are hard to verify on your own.
            </p>
            <div class="tc-meter">
              <div class="tc-meter__track">
                <div class="tc-meter__fill" style="width:${score}%"></div>
              </div>
              <div class="tc-meter__meta">
                <span>Traceability score (0 = weak, 100 = strong)</span>
                <span><strong>${score}</strong> / 100</span>
              </div>
            </div>
            <p class="tc-footnote" style="margin-top:10px">
              Links detected in this post (demo): <strong>${esc(data.traceability?.citationsInTweet ?? 0)}</strong>.
              Allow-listed outlets that matched this topic (demo): <strong>${esc(data.traceability?.sourcesFound ?? 0)}</strong>.
            </p>
            ${renderEntities(data.traceability?.entities)}
            ${renderList(data.traceability?.notes)}
          </div>

          <div class="tc-card">
            <div class="tc-card__head">
              <h2 class="tc-card__title">Credible alternatives</h2>
            </div>
            <p class="tc-section-intro" style="margin-bottom:8px">
              Examples of reporting from other <strong>allow-listed</strong> outlets on the same topic.
              Reading more than one story helps you spot bias, missing context, and different framing—even when everyone is reporting in good faith.
            </p>
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
