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

- **Adopt the real dither stack** (owner decision, supersedes the earlier hand-rolled-CSS
  approach): add Tailwind CSS v4 + shadcn/ui scaffolding to `landing/`, then install
  dither-kit components via `npx @dither-kit/cli add <component>` (equivalently
  `npx shadcn@latest add https://tripwire.sh/r/<component>.json`).
- **Incremental migration, not a rewrite**: Tailwind v4 coexists with the existing
  `globals.css`. Existing layout/section CSS stays; dither-kit components and Tailwind
  utilities are used where the vibe matters. Full utility-class migration of legacy CSS
  is explicitly out of scope.
- No new font downloads: IBM Plex Mono is already imported; SF Pro system stack stays for
  headlines/body.
- No structural/layout changes to sections; existing tests must keep passing.
- Palette unchanged (white bg, ink, blue accent, grade colors) so app screenshots still
  match the site; dither-kit chart colors mapped to the existing tokens.

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

## 3. Dither layer (Tailwind + shadcn + dither-kit)

Setup (one-time):
- Add Tailwind CSS v4 (`@tailwindcss/postcss`) and shadcn/ui init (`components.json`,
  `cn` util, CSS variables mapped to the existing palette tokens) to `landing/`.
- Install dither-kit components into `landing/src/components/dither-kit/` via the CLI.

Component usage:
- **`DitherGradient`** — hero background wash (replaces the blurred radial gradients;
  the single biggest vibe shift), `oc-lead` outcome card background, pricing card header
  (`.price-top`), FooterCta backdrop. Tinted blue from existing tokens.
- **`DitherButton`** — primary CTAs (hero waitlist submit, pricing buttons, FooterCta);
  ghost/secondary buttons get a 1px hard border and reduced radius via Tailwind classes.
- **Dithered charts** (`Sparkline`, `BarChart` / `AreaChart`) — EvidenceStrip stats gain
  small dithered sparklines; Outcomes lead card gets a dithered bar/area visual of the
  token-cost benchmark; hero mockup ring/progress bars re-rendered with dithered fills.
- **`DitherAvatar`** — optional garnish (e.g. blog byline / footer), only if it earns
  its place.
- Subtle static dither texture on `.tint` section backgrounds and section dividers may
  still use a small CSS/SVG pattern where a canvas component is overkill.
- Charts respect `prefers-reduced-motion` (disable entrance animations/sparkles).

## 4. Out of scope

- Dark mode, blog article content, thanks page redesign (inherits token changes only),
  any layout/structure changes, pricing/FAQ copy changes, full Tailwind migration of the
  legacy `globals.css` (follow-up if ever needed).

## 5. Files touched

- Setup: `landing/package.json`, PostCSS config, `components.json`, `globals.css`
  (Tailwind import + shadcn CSS variables), `landing/src/lib/utils.ts` (`cn`),
  `landing/src/components/dither-kit/*` (CLI-generated, committed).
- Copy: `Hero.tsx`, `Outcomes.tsx`, `TagStrip.tsx`, `FeatureRows.tsx`, `Audience.tsx`,
  `FooterCta.tsx`.
- Styling touches: `.num`/mono classes in `EvidenceStrip.tsx`, `Pricing.tsx`,
  `HowItWorks.tsx`, `MiniCards.tsx`, mockup components, blog list/post styles;
  dither-kit component swaps per section 3.

## 6. Acceptance

- Page reads pain → fix in every section headline.
- All numerals render in mono with tabular figures.
- Dither-kit washes/charts/buttons visible in hero, lead outcome card, evidence stats,
  pricing header, CTAs — without harming text readability or a11y contrast.
- `pnpm --dir landing test` (vitest) and `pnpm --dir landing build` pass with the new
  Tailwind/PostCSS pipeline.
- New dependencies limited to the dither stack (tailwindcss, shadcn scaffolding,
  dither-kit peer deps such as motion/d3 as required by the CLI).
