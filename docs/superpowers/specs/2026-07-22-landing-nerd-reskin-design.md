# Landing page reskin: pain-first copy + nerd/dither layer

Date: 2026-07-22
Status: approved by owner (brainstorming session)

## Goal

Make the pre-launch landing site (`landing/`) shareable for waitlist growth:

1. **Copy**: every section leads with the pain (flaky agents, wasted tokens/turns/time)
   and immediately answers it with the product. Replaces the current feature/benefit-first
   framing.
2. **Visual**: keep the current light Cupertino structure but layer a "nerdy
   analytics/performance tool" identity on top — monospace numerals, mono uppercase
   labels, and ordered-dither textures inspired by the dither trend
   (tripwire.sh/dither-kit).

## Constraints

- Stack stays as-is: Next.js, hand-rolled `globals.css`. **No Tailwind, no shadcn, no
  @dither-kit/cli** (the kit requires a stack the landing doesn't have; we hand-roll the
  aesthetic in CSS/SVG).
- No new font downloads: IBM Plex Mono is already imported; SF Pro system stack stays for
  headlines/body.
- No structural/layout changes to sections; no new deps; existing tests must keep passing.
- Palette unchanged (white bg, ink, blue accent, grade colors) so app screenshots still
  match the site.

## 1. Copy changes (component by component)

### Hero (`Hero.tsx`)
- Eyebrow → three mono bracket-tags: `[macOS]` `[100% LOCAL]` `[LAUNCHING SOON]`.
- H1: **"Flaky agents aren't a model problem. They're a prompt problem."**
- Lead: *"The CLAUDE.md you wrote six weeks ago is sabotaging today's runs. Prompt
  Janitor hunts down every rotting prompt file on your Mac, grades it A–F, and hands you
  the fix — dependable agents, fewer retries, fewer tokens."*
- Trust row facts unchanged.

### Outcomes (`Outcomes.tsx`)
- H2: **"Rotting prompts are a tax you pay on every run"**; sub: *"Every defect charges
  you again on every task, in every repo — in tokens, in extra turns, in your own review
  time. Here's the bill."*
- Lead card: kicker `THE DEFECT TAX`, title **"One missing example = +36.8k tokens. Per
  task."**; body keeps benchmark story, ends: *"Finding and fixing defects is the
  cheapest optimization you haven't done — and it's exactly what the scan hands you."*
- Card titles: **"Stop babysitting the output"** (−0.4 issues), **"Stop watching agents
  wander"** (+0.8 turns). Roadmap cards unchanged.

### EvidenceStrip — copy unchanged; numerals go mono.

### TagStrip (`TagStrip.tsx`)
- H2: **"Right now, you're flying blind."**; sub: *"No linter, no review, no grade for
  the files your agents read on every single run. Prompt Janitor is the missing
  instrument panel."*

### FeatureRows (`FeatureRows.tsx`) — pain → answer headlines:
1. **"'Is this prompt any good?' Stop guessing."** (A–F score per file, rolled up per project)
2. **"Find the rot before your agent trips on it"** (stale model names, contradictions,
   missing examples; source-cited with a fix)
3. **"House rules die in Slack threads. Not anymore."** (plain-English custom rules,
   checked every scan)
4. **"Not another dashboard to babysit"** (background scans, menu-bar glance,
   regression-only alerts)
Body copy adjusted minimally to fit the new headline; facts unchanged.

### HowItWorks — unchanged ("Scan. Grade. Treat.").

### Audience (`Audience.tsx`) — persona lines get their pain:
- Solo developers: *"Your one CLAUDE.md drifts while you ship. Keep it sharp without
  thinking about it."*
- Eng teams & leads: *"You can't review every repo's prompt files. Now you don't have to."*
- Remaining four personas: same pattern (pain clause + relief clause), facts unchanged.

### Philosophy, Pricing, FAQ, MiniCards — copy unchanged; numeral/label styling only.

### FooterCta (`FooterCta.tsx`)
- H2: **"Stop blaming the model."**
- Sub: *"Fix the files it reads. Waitlist members launch first, at early-bird pricing."*

## 2. Typography

- New utility class `.num` in `globals.css`: `font-family: var(--mono);
  font-variant-numeric: tabular-nums;` (+ weight/letter-spacing tuning). Applied to every
  numeral on the page: evidence stats, outcome stats, prices, grades, step numbers, blog
  dates, mockup scores/counts.
- Eyebrows/kickers/labels (`.eyebrow`, `.oc-kicker`, `.plist-intro`, footer col heads)
  switch to mono uppercase with letter-spacing.

## 3. Dither layer (hand-rolled CSS/SVG)

- 3–4 Bayer ordered-dither patterns as inline SVG data-URIs, defined once as CSS custom
  properties (density steps sparse → dense), tintable via `background-color` +
  pattern overlay.
- Applied to:
  - Hero background wash — replaces the blurred radial gradients with a dithered blue
    fade (the single biggest vibe shift).
  - `oc-lead` outcome card background.
  - Section dividers between major blocks.
  - `.tint` section backgrounds (subtle sparse dot field).
  - Pricing card header (`.price-top`).
  - Hero mockup progress bars/ring: dithered fills instead of smooth gradients.
- Buttons: primary keeps solid blue with a dithered hover/edge texture; ghost buttons get
  a 1px hard border; border-radius reduced from pill to small on buttons and form inputs.

## 4. Out of scope

- Dark mode, blog article content, thanks page redesign (inherits token changes only),
  actual @dither-kit components, any layout/structure changes, pricing/FAQ copy changes.

## 5. Files touched

`landing/src/app/globals.css`, `Hero.tsx`, `Outcomes.tsx`, `TagStrip.tsx`,
`FeatureRows.tsx`, `Audience.tsx`, `FooterCta.tsx`, plus `.num`/mono class touches in
`EvidenceStrip.tsx`, `Pricing.tsx`, `HowItWorks.tsx`, `MiniCards.tsx`, mockup components,
blog list/post styles.

## 6. Acceptance

- Page reads pain → fix in every section headline.
- All numerals render in mono with tabular figures.
- Dither textures visible in hero wash, lead outcome card, tint sections, pricing header,
  mockup fills — at normal zoom, without harming text readability or a11y contrast.
- `pnpm --dir landing test` (vitest) and `pnpm --dir landing build` pass.
- No new runtime dependencies.
