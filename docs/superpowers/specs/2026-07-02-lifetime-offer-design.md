# Prompt Janitor — Offer & Monetization Design ("Lifetime" purchase)

- **Date:** 2026-07-02
- **Status:** Draft — pending owner review
- **Owner:** Ahmed ABOUELLEIL
- **Relates to:** [`2026-06-04-prompt-janitor-design.md`](2026-06-04-prompt-janitor-design.md) (§2 decision 6, §7, §12) and [`2026-06-20-prompting-standards-design.md`](2026-06-20-prompting-standards-design.md) (#72 — one locked decision changes, see §5)

---

## 1. Pain & promise

The raw pain — "am I leveraging my LLMs as much as possible?" — is a doubt, not a pain.
The sellable version is money-denominated:

> Devs pay $20–200/month for Claude/Cursor/Copilot, and two people with the same
> subscription get wildly different output. The difference is their instruction files.
> Part of that subscription burns every month on retries, garbage context, and stale
> `CLAUDE.md` files nobody audits.

**Headline promise:** *"You're paying $200/mo for AI and getting D-grade results. Your
instruction files are why. Get graded free — get to an A in one click."*

The blame lands on a fixable artifact (the file), never on the dev's skill. The free
grade creates the pain; the paid tier is the painkiller.

## 2. Avatar

**Solo devs paying out of pocket** for AI coding tools. They feel the cost personally,
they are reachable free (X, HN, r/ClaudeAI), and they natively buy one-time-purchase
Mac tools (Alfred, Dash, TablePlus crowd).

Teams are **explicitly later**: an annual per-seat SKU (shared standards, CI check,
admin) sold bottom-up by the solo users we win now. No team features before then.

## 3. Money model

| Element | Decision |
|---|---|
| Individual license | **One-time purchase: perpetual license + 12 months of feature updates** |
| Price | **$69 founder pricing at launch → $99** after the launch window |
| Updates renewal | **$29/yr, optional, never required to keep using the app** (say this verbatim on the pricing page) |
| Floor | Never below $49 — in this category low price reduces believability, not friction |
| Teams (later) | Annual per-seat, separate SKU |
| Hosted inference | **Never.** AI runs on the user's Ollama or BYO key → zero COGS, which is what makes a one-time price sustainable |

Rationale: devs resent tool subscriptions (especially while bleeding monthly on AI —
"a subscription to fix your subscriptions" is incoherent); companies prefer annual
invoicing. One model per segment, not one model for the company.

## 4. Free / paid line — "Diagnosis free. Treatment paid."

**Positioning sentence:** *"We grade your prompt files against the industry's own
standards — free, unlimited, on your machine, with your compute. Grading against
YOUR standards, and fixing anything — that's Pro."*

### Free forever (the funnel)
- Scanning, scheduling, watch mode, notifications, history/trends — **no scan caps, ever**.
- Deterministic **fact rules** (expanded, see §6) — full detail, every finding, cited.
- **Built-in NL standards catalog evaluation (#72) — free when the user brings compute**
  (local Ollama or BYO API key). No license required for any diagnosis.
- Standards-catalog and rule-pack **updates flow to free users** — diagnosis updates
  grow the funnel forever.
- Findings are **never hidden or blurred**. The honest teaser is incompleteness, not
  obscurity: without a provider configured, show *"Graded on N of 40+ standards —
  the NL standards need a local model or API key"*, listing the unevaluated
  standards by name.

### Pro — one-time purchase (the treatment)
- AI **rewrites** and **Apply fix / Auto-fix N** (backup, undo, optional git branch).
- **Custom NL rules** (your standards, AI-evaluated) — stays paid as shipped in #63;
  built-in catalog = industry standards = free, personal catalog = Pro.
- **Starter template packs** — A-grade exemplar `CLAUDE.md` / `AGENTS.md` /
  `.cursorrules` per stack (serves the "I have no file at all" dev).
- **Prompt-File Field Guide** — the #72 standards doc packaged as a named bonus.
- **12 months of feature updates** (the year-1 roadmap, §8), renewable.

Conversion mechanics: free AI diagnosis surfaces *more* issues → more visible-but-
disabled Fix buttons → stronger upsell. Free depth feeds paid demand. Upgrade pressure
comes from **presence, not scarcity** (disabled Fix buttons, regression notifications) —
never from caps or hidden findings.

### Guarantee (self-verifying)
> **"If your prompt-file health doesn't go up a full letter grade within 30 days, full refund."**

The app measures the promise itself (grade history). Outcome-based, near-impossible to
copy, and the free tier already shows the grade before purchase — risk at checkout ≈ 0.

## 5. Change to in-flight #72

The prompting-standards design locked *"Default state: enabled by default (only fire on
the explicit, paid NL action)."* **This changes:**

- NL catalog evaluation fires whenever a **provider is available** (Ollama detected or
  BYO key configured) — **no license check**.
- The offline license entitlement now gates **treatment only**: apply/auto-fix, AI
  rewrites, custom NL rules (and templates/field guide access).
- The 2026-06-04 spec's decision 6 ("NL rules ride the paid AI layer") narrows to
  **custom** NL rules only.

## 6. Pre-launch build additions

The current 5 deterministic rules are too thin to carry the free grade's credibility.
Deterministic ≠ shallow: facts checked against repo reality are *more* credible than AI
judgment (zero false positives, verifiable in seconds).

1. **Fact-rules expansion (5 → ~15–20), timebox 2 weeks.** Candidates:
   - Dead references: instruction mentions files/scripts that don't exist in the repo.
   - Command/reality mismatch: says `yarn test` but the repo has `pnpm-lock.yaml`;
     referenced npm scripts missing from `package.json`.
   - Deprecated/hardcoded model names (generalize the existing rule with a currency list).
   - Token budget: file size in tokens vs. a context-share threshold.
   - Duplicate/near-duplicate rules within a file.
   - Staleness vs. churn: file untouched N months while the repo commits heavily.
   - Placeholder rot: TODO/FIXME/lorem left in instruction files.
   - Legacy format: `.cursorrules` present instead of `.cursor/rules/*.mdc`.
2. **Starter template packs** — 3–5 stacks at launch (cut scope before cutting the date).
3. **Field Guide packaging** — from the #72 standards doc; near-zero marginal work.

If the additions threaten the launch date by more than ~2 weeks, cut templates to 3
stacks and ship.

## 7. Launch sequence

1. Ship **#72** (with the §5 gate change) — spine of both tiers.
2. **Fact-rules expansion** (§6.1) — the free grade must survive HN scrutiny.
3. Templates + Field Guide (§6.2–3).
4. Finish **Phase 5** (sign/notarize/DMG — in flight).
5. **Content grenade, not an announcement:** grade public `CLAUDE.md`/`.cursorrules`
   from well-known OSS repos against the vendors' published standards; publish the
   leaderboard ("I graded 500 public CLAUDE.md files; 60% got a D or worse").
   CTA = free scan. Channels: HN, X, r/ClaudeAI. Zero ad spend.
6. Founder-pricing window ($69 → $99) as honest launch urgency.

Landing headline: *"Your AI tools are only as good as your instruction files. Yours are
probably a D. Prove me wrong — free scan."*

## 8. Year-1 roadmap (the renewal engine)

Renewal (~$29/yr) only sells if year 1 visibly ships. Filter for scope: **stays in the
wedge (artifacts that shape your AI's behavior)** and makes the renewal email write
itself.

| When | Update | Tier | Why |
|---|---|---|---|
| Month 1–2 | **Skills/commands/agents/MCP auditing** — grade `SKILL.md`, `.claude/commands/*.md`, `.claude/agents/*.md`, `.mcp.json`, settings hygiene; new globs + rule packs on the existing engine | Diagnosis → free | Cheap (same scan path), highly visible, skills are exploding; grows the funnel |
| Month 3–4 | **Cross-tool sync** — write standards once, sync CLAUDE.md ↔ .cursorrules ↔ AGENTS.md ↔ copilot-instructions | Treatment → Pro | Real multi-tool pain; first proof that paid updates are worth it |
| Month 5–8 | **Evidence mode (flagship)** — mine the user's own session transcripts for repeated corrections; propose concrete rules/edits to their files, cited to their own history | Treatment → Pro | Upgrades PJ from linter to profiler; strongest possible proof ("your own transcripts say so"); local-first = privacy advantage |
| Continuous | Standards-catalog refreshes as Anthropic/OpenAI/Cursor guidance moves | Free | Keeps grades current; each refresh is a small marketing moment |
| Late year 1 | Team edition exploration (shared standards, CI check, admin; annual per-seat) | New SKU | Bottom-up demand from solo users |

Evidence mode is framed as *"turn your history into rules"* — never as grading the
human's chat habits (never make the customer the problem).

## 9. Explicitly rejected (with reasons)

- **Hiding the "why" / blurring findings in free** — kills the credibility that drives
  conversion; reads as scareware to a dark-pattern-hostile audience.
- **Scan caps** — grading has zero marginal cost; caps strangle the regression-
  notification loop that surfaces upgrade moments.
- **Uncapped lifetime-everything** — funding evolving standards forever on a dead
  payment; acceptable only as a *capped* founder deal if ever used.
- **Subscription for individuals** — incoherent with the pitch; resented by the avatar.
- **Teams-first launch** — sells enforcement features that don't exist yet; months of
  build before first revenue.
- **Off-wedge features** (cost dashboards, model pickers, token analytics) — owned by
  others; dilutes the story.
- **Hosted inference** — reintroduces COGS and forces subscriptions.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Paid tier must carry $69 on treatment alone | Visible disabled Fix buttons at every finding; templates + field guide pad the stack; letter-grade guarantee; year-1 Pro roadmap |
| Free AI depth cannibalizes purchases | DIY fixers were never buyers — they become evangelists; buyers pay for speed/done-for-you |
| Ollama/BYO-key setup friction blunts the free AI tier | The deterministic fact grade is the zero-setup hook; detect Ollama and guide install (already designed) |
| Free grade not credible at launch | §6 fact-rules expansion is a launch blocker on purpose |
