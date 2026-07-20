// Renders STATUS.html — the project's live inspection report — from
// docs/status/data.json. Run with `pnpm status` after updating the data file.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(resolve(root, "docs/status/data.json"), "utf8"));

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const KIND_LABEL = { testing: "testing", review: "review", external: "external action", vision: "vision call" };

const TIER_LABEL = { free: "Free tier", pro: "Pro tier", infra: "Infrastructure" };

const STATUS_STAMP = {
  shipped: ["shipped", "ok"],
  pr: ["PR open", "warn"],
  blocked: ["needs you", "stop"],
  missing: ["missing", "stop"],
};

function actionGroup(title, sub, items, numbered) {
  const rows = items
    .map(
      (a, i) => `
      <li class="action">
        ${numbered ? `<span class="action__num">${i + 1}</span>` : `<span class="action__dot"></span>`}
        <div class="action__body">
          <div class="action__head">
            <strong>${esc(a.title)}</strong>
            <span class="tag tag--${esc(a.kind)}">${esc(KIND_LABEL[a.kind] ?? a.kind)}</span>
          </div>
          <p>${esc(a.detail)}</p>
        </div>
      </li>`
    )
    .join("");
  return `
    <div class="action-group">
      <h3>${esc(title)} <small>${esc(sub)}</small></h3>
      <ol class="actions">${rows}</ol>
    </div>`;
}

function phaseRow(p) {
  const pct = Math.round((p.done / p.total) * 100);
  return `
    <li class="phase phase--${esc(p.state)}">
      <div class="phase__label"><span class="phase__name">${esc(p.name)}</span> ${esc(p.title)}</div>
      <div class="phase__meter" role="img" aria-label="${pct}% complete">
        <div class="phase__fill" style="width:${pct}%"></div>
      </div>
      <div class="phase__count">${p.done}/${p.total}</div>
      <p class="phase__note">${esc(p.note)}</p>
    </li>`;
}

function featureRows(tier) {
  return data.features
    .filter((f) => f.tier === tier)
    .map((f) => {
      const [label, tone] = STATUS_STAMP[f.status] ?? [f.status, "warn"];
      return `
      <tr>
        <td>${esc(f.name)}${f.note ? ` <span class="muted">— ${esc(f.note)}</span>` : ""}</td>
        <td><span class="stamp stamp--${tone}">${esc(label)}</span></td>
      </tr>`;
    })
    .join("");
}

function featureTable() {
  return ["free", "pro", "infra"]
    .map(
      (tier) => `
      <tbody>
        <tr class="tier-row"><th colspan="2">${TIER_LABEL[tier]}</th></tr>
        ${featureRows(tier)}
      </tbody>`
    )
    .join("");
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Prompt Janitor — Status</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,900&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
  :root {
    --paper: #f6f1e6;
    --paper-deep: #efe7d6;
    --ink: #221d14;
    --ink-soft: #6e6452;
    --rule: #d8cdb6;
    --red: #b3331d;
    --green: #2e6e46;
    --amber: #a36c0c;
    --serif: "Fraunces", Georgia, serif;
    --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    background:
      repeating-linear-gradient(0deg, rgba(34,29,20,.022) 0 1px, transparent 1px 3px),
      var(--paper);
    color: var(--ink);
    font: 15px/1.6 var(--mono);
    padding: 0 24px 96px;
  }
  .sheet { max-width: 1020px; margin: 0 auto; }
  a { color: inherit; }
  .muted { color: var(--ink-soft); }

  /* ---------- header ---------- */
  header { padding: 56px 0 28px; border-bottom: 3px double var(--ink); }
  .overline {
    display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;
    font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: var(--ink-soft);
  }
  h1 {
    font: 900 clamp(44px, 7vw, 76px)/1 var(--serif);
    margin: 18px 0 8px; letter-spacing: -.01em;
  }
  h1 em { font-style: italic; font-weight: 400; }
  .readiness { display: flex; align-items: center; gap: 20px; margin-top: 26px; flex-wrap: wrap; }
  .readiness__pct { font: 600 54px/1 var(--serif); }
  .readiness__bar {
    flex: 1; min-width: 220px; height: 14px; border: 1.5px solid var(--ink);
    background: var(--paper-deep); position: relative;
  }
  .readiness__fill {
    position: absolute; inset: 2px auto 2px 2px; width: calc(${Number(data.readiness.percent)}% - 4px);
    background: repeating-linear-gradient(135deg, var(--ink) 0 6px, transparent 6px 10px);
  }
  .readiness__label { width: 100%; font-size: 13px; color: var(--ink-soft); }

  /* ---------- sections ---------- */
  section { margin-top: 56px; }
  h2 {
    font: 600 13px var(--mono); letter-spacing: .24em; text-transform: uppercase;
    border-bottom: 1.5px solid var(--ink); padding-bottom: 8px; margin: 0 0 22px;
    display: flex; justify-content: space-between; align-items: baseline;
  }
  h2 .index { color: var(--ink-soft); }

  /* ---------- your move ---------- */
  .yourmove {
    border: 2.5px solid var(--red); outline: 1.5px solid var(--red); outline-offset: 4px;
    padding: 30px 30px 18px; position: relative; background: #fbf7ec;
  }
  .yourmove::before {
    content: "ONLY YOU CAN DO THESE";
    position: absolute; top: -14px; left: 24px; background: var(--red); color: #fbf7ec;
    font: 600 11px var(--mono); letter-spacing: .2em; padding: 5px 12px;
  }
  .yourmove h3 {
    font: 900 22px var(--serif); margin: 26px 0 14px; color: var(--red);
  }
  .yourmove h3 small { font: 400 13px var(--mono); color: var(--ink-soft); margin-left: 10px; }
  .yourmove .action-group:first-child h3 { margin-top: 0; }
  .actions { list-style: none; margin: 0; padding: 0; }
  .action { display: flex; gap: 16px; padding: 12px 0; border-top: 1px dashed var(--rule); }
  .action__num {
    font: 900 26px/1.2 var(--serif); color: var(--red); min-width: 26px; text-align: right;
  }
  .action__dot { min-width: 26px; text-align: right; }
  .action__dot::before { content: "◆"; color: var(--red); font-size: 11px; }
  .action__head { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
  .action__body p { margin: 6px 0 0; font-size: 13.5px; color: var(--ink-soft); }
  .tag {
    font-size: 10px; letter-spacing: .14em; text-transform: uppercase;
    border: 1px solid currentColor; padding: 2px 7px; white-space: nowrap;
  }
  .tag--testing { color: var(--amber); }
  .tag--review { color: var(--green); }
  .tag--external { color: var(--red); }
  .tag--vision { color: #5b4a8a; }

  /* ---------- roadmap ---------- */
  .phases { list-style: none; margin: 0; padding: 0; }
  .phase {
    display: grid; grid-template-columns: 280px 1fr 64px; gap: 6px 18px;
    align-items: center; padding: 13px 0; border-bottom: 1px solid var(--rule);
  }
  .phase__name { font-weight: 600; color: var(--ink-soft); margin-right: 6px; }
  .phase__label { font-size: 14px; }
  .phase--active .phase__label { font-weight: 600; }
  .phase__meter { height: 10px; border: 1.5px solid var(--ink); background: var(--paper-deep); position: relative; }
  .phase__fill { position: absolute; inset: 1.5px auto 1.5px 1.5px; background: var(--green); }
  .phase--active .phase__fill { background: var(--amber); }
  .phase__count { text-align: right; font-size: 13px; }
  .phase__note { grid-column: 1 / -1; margin: 0; font-size: 12.5px; color: var(--ink-soft); }
  @media (max-width: 720px) { .phase { grid-template-columns: 1fr 64px; } .phase__label { grid-column: 1 / -1; } }

  /* ---------- capabilities ---------- */
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  td, th { padding: 9px 10px; border-bottom: 1px solid var(--rule); text-align: left; vertical-align: top; }
  .tier-row th {
    font: 900 17px var(--serif); padding-top: 26px; border-bottom: 1.5px solid var(--ink);
  }
  td:last-child { width: 110px; text-align: right; }
  .stamp {
    display: inline-block; font-size: 10.5px; font-weight: 600; letter-spacing: .12em;
    text-transform: uppercase; padding: 3px 8px; border: 1.5px solid currentColor;
    transform: rotate(-2deg);
  }
  .stamp--ok { color: var(--green); }
  .stamp--warn { color: var(--amber); }
  .stamp--stop { color: var(--red); }

  /* ---------- health / two-col ---------- */
  .badges { display: flex; flex-wrap: wrap; gap: 10px; }
  .badge {
    border: 1.5px solid var(--ink); padding: 8px 14px; font-size: 12.5px; background: var(--paper-deep);
  }
  .badge b { color: var(--green); font-weight: 600; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
  @media (max-width: 720px) { .cols { grid-template-columns: 1fr; } }
  .plain { list-style: none; margin: 0; padding: 0; font-size: 13.5px; }
  .plain li { padding: 9px 0; border-bottom: 1px dashed var(--rule); }
  .plain .ref { color: var(--ink-soft); margin-right: 8px; }

  footer {
    margin-top: 72px; padding-top: 16px; border-top: 3px double var(--ink);
    font-size: 12px; color: var(--ink-soft); display: flex; justify-content: space-between;
    gap: 12px; flex-wrap: wrap;
  }
  code { background: var(--paper-deep); padding: 1px 5px; }

  /* staggered load */
  @media (prefers-reduced-motion: no-preference) {
    header, section, footer { animation: rise .5s cubic-bezier(.2,.7,.3,1) both; }
    section:nth-of-type(1) { animation-delay: .06s; }
    section:nth-of-type(2) { animation-delay: .12s; }
    section:nth-of-type(3) { animation-delay: .18s; }
    section:nth-of-type(4) { animation-delay: .24s; }
    section:nth-of-type(5) { animation-delay: .3s; }
    @keyframes rise { from { opacity: 0; transform: translateY(14px); } }
  }
</style>
</head>
<body>
<div class="sheet">
  <header>
    <div class="overline">
      <span>Inspection report — internal</span>
      <span>v${esc(data.version)} · updated ${esc(data.updated)}</span>
    </div>
    <h1>Prompt Janitor <em>status</em></h1>
    <div class="readiness">
      <span class="readiness__pct">${Number(data.readiness.percent)}<small>%</small></span>
      <div class="readiness__bar"><div class="readiness__fill"></div></div>
      <span class="readiness__label">${esc(data.readiness.label)}</span>
    </div>
  </header>

  <section aria-labelledby="ym">
    <h2 id="ym"><span>Your move</span><span class="index">§1</span></h2>
    <div class="yourmove">
      ${actionGroup("Blocking v1 — do these in order", "ship gate", data.actions.blocking, true)}
      ${actionGroup("Before marketing", "polish gate", data.actions.marketing, false)}
      ${actionGroup("Decisions to make", "vision", data.actions.decisions, false)}
    </div>
  </section>

  <section aria-labelledby="rm">
    <h2 id="rm"><span>Roadmap position</span><span class="index">§2</span></h2>
    <ol class="phases">
      ${data.phases.map(phaseRow).join("")}
    </ol>
  </section>

  <section aria-labelledby="cap">
    <h2 id="cap"><span>Capabilities</span><span class="index">§3</span></h2>
    <table>
      ${featureTable()}
    </table>
  </section>

  <section aria-labelledby="hl">
    <h2 id="hl"><span>Repo health <span class="muted">— as of ${esc(data.updated)}</span></span><span class="index">§4</span></h2>
    <div class="badges">
      ${data.health.map((h) => `<span class="badge">${esc(h.name)} <b>${esc(h.result)}</b></span>`).join("")}
    </div>
  </section>

  <section>
    <div class="cols">
      <div>
        <h2><span>Post-v1 backlog</span><span class="index">§5</span></h2>
        <ul class="plain">
          ${data.backlog.map((b) => `<li><span class="ref">${esc(b.ref)}</span><strong>${esc(b.title)}</strong> <span class="muted">— ${esc(b.note)}</span></li>`).join("")}
        </ul>
      </div>
      <div>
        <h2><span>Recent changes</span><span class="index">§6</span></h2>
        <ul class="plain">
          ${data.recent.map((r) => `<li>${esc(r)}</li>`).join("")}
        </ul>
      </div>
    </div>
  </section>

  <footer>
    <span>Generated from <code>docs/status/data.json</code> by <code>pnpm status</code> — edit the data, never this file.</span>
    <span>Claude keeps this current after every change (see CLAUDE.md).</span>
  </footer>
</div>
</body>
</html>
`;

writeFileSync(resolve(root, "STATUS.html"), html);
console.log("✓ STATUS.html regenerated from docs/status/data.json");
