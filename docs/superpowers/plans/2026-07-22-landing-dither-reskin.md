# Landing Dither Reskin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the pre-launch landing site with pain-first section copy and a dither/nerd visual identity built on Tailwind v4 + shadcn scaffolding + dither-kit components.

**Architecture:** Incremental adoption — Tailwind v4 utilities/theme are imported WITHOUT preflight so the existing hand-rolled `globals.css` keeps working; dither-kit components (`DitherGradient`, `DitherButton`, `Sparkline`) are installed via the shadcn registry into `src/components/dither-kit/` and swapped in where the vibe matters. Copy changes are plain JSX edits.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4 (`@tailwindcss/postcss`), shadcn registry conventions, `@dither-kit` registry (tripwire.sh), IBM Plex Mono (already imported), vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-22-landing-nerd-reskin-design.md`. Copy strings there are verbatim requirements.
- Package manager: pnpm. `landing/` is its own pnpm workspace — run installs as `pnpm --dir landing add …`, scripts as `pnpm --dir landing <script>`.
- No layout/structure changes to sections. Palette tokens unchanged. No new fonts.
- Full Tailwind migration of legacy CSS is OUT OF SCOPE — do not convert existing classes.
- Every task ends: `pnpm --dir landing test` and `pnpm --dir landing build` pass (these ARE the test cycle for this copy/styling work; there is no unit-test surface for JSX copy).
- Work on branch `feat/landing-dither-reskin`; PR at the end; STATUS dashboard updated in the same PR (project CLAUDE.md mandate).
- Dither components are decorative: `aria-hidden="true"` on washes/sparklines, `animate={false}` or reduced-motion-safe.

---

### Task 1: Branch + Tailwind v4 + shadcn scaffolding

**Files:**
- Create: `landing/postcss.config.mjs`, `landing/components.json`, `landing/src/lib/utils.ts`
- Modify: `landing/src/app/globals.css` (top of file), `landing/package.json` (via pnpm)

**Interfaces:**
- Produces: `cn(...inputs)` at `@/lib/utils`; Tailwind theme+utilities available in all components; `components.json` aliases so the dither-kit CLI installs under `src/components/dither-kit`.

- [ ] **Step 1: Branch**

```bash
git checkout -b feat/landing-dither-reskin
```

- [ ] **Step 2: Install deps**

```bash
pnpm --dir landing add -D tailwindcss @tailwindcss/postcss postcss
pnpm --dir landing add clsx tailwind-merge
```

- [ ] **Step 3: PostCSS config** — create `landing/postcss.config.mjs`:

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 4: Import Tailwind WITHOUT preflight** — at the very top of `landing/src/app/globals.css` (above the Google Fonts `@import`, which must move below or stay first per CSS rules — put Tailwind layer imports first, then the font `@import` will be invalid; SO: keep the font import first, Tailwind imports directly after it):

```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
```

(No `tailwindcss/preflight.css` — legacy CSS must not be reset.)

- [ ] **Step 5: `cn` util** — create `landing/src/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 6: components.json** — create `landing/components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 7: Verify** — `pnpm --dir landing build` and `pnpm --dir landing test` → both pass. Run `pnpm --dir landing dev` briefly and eyeball `http://localhost:3000` — page must look IDENTICAL to before (no preflight leakage).

- [ ] **Step 8: Commit**

```bash
git add landing/postcss.config.mjs landing/components.json landing/src/lib/utils.ts landing/src/app/globals.css landing/package.json landing/pnpm-lock.yaml
git commit -m "feat(landing): add Tailwind v4 (no preflight) + shadcn scaffolding"
```

---

### Task 2: Install dither-kit components

**Files:**
- Create (CLI-generated, committed): `landing/src/components/dither-kit/*` — gradient, button, area-chart/sparkline + shared core files.

**Interfaces:**
- Produces: `DitherGradient` (`from`, `to="transparent"`, `direction="up"`, `cell=3`, `opacity=1`, `bloom="off"`, `className`), `DitherButton` (native `<button>` props + `color="blue"`, `variant="gradient"|"dotted"|"hatched"|"solid"`, `bloom`), `Sparkline` (`data: number[]`, `color`, `variant`, `animate`, `className`) — all imported from `@/components/dither-kit/<file>`.

- [ ] **Step 1: Install via CLI** (run inside `landing/`):

```bash
cd landing && npx -y @dither-kit/cli add gradient button area-chart
```

Fallback if the CLI misbehaves: `npx -y shadcn@latest add https://tripwire.sh/r/gradient.json https://tripwire.sh/r/button.json https://tripwire.sh/r/area-chart.json`

- [ ] **Step 2: Inspect installed files** — read every file under `landing/src/components/dither-kit/`; note exact export names/paths and any extra deps the CLI added to package.json. If files landed outside `src/` (e.g. `landing/components/`), move them to `landing/src/components/dither-kit/` and fix imports.

- [ ] **Step 3: Verify** — `pnpm --dir landing build` passes (typecheck included).

- [ ] **Step 4: Commit**

```bash
git add landing/src/components/dither-kit landing/package.json landing/pnpm-lock.yaml
git commit -m "feat(landing): vendor dither-kit gradient/button/sparkline components"
```

---

### Task 3: Mono-numeral typography layer

**Files:**
- Modify: `landing/src/app/globals.css`

**Interfaces:**
- Produces: `.num` utility class; mono uppercase label styling on existing selectors (no JSX changes needed where a selector already targets the numeral).

- [ ] **Step 1: Add `.num` + retarget numeral/label selectors** in `globals.css`:

Add after the `.faint` rule:

```css
.num { font-family: var(--mono); font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
```

Change these existing rules' `font-family: var(--display)` → `var(--mono)` and add `font-variant-numeric: tabular-nums;`:
- `.ev-stat .n` (evidence stats)
- `.oc-stat` (outcome stat — already has tabular-nums)
- `.price-amount .now` (and add `font-family: var(--mono)` to `.price-amount .was`)
- `.how-step .n` (step numbers)
- `.mk-score`, `.mk-num`, `.mk-ring span` (mockup numerals)
- `.post-date` (blog dates)

Change label rules to mono uppercase (add `font-family: var(--mono); text-transform: uppercase;` where missing, keep sizes):
- `.eyebrow`
- `.oc-kicker`
- `.plist-intro`
- `.footer-cols h5`

- [ ] **Step 2: Verify** — `pnpm --dir landing build` passes; dev-server eyeball: all stats/prices/grades render mono with aligned digits.

- [ ] **Step 3: Commit**

```bash
git add landing/src/app/globals.css
git commit -m "feat(landing): mono tabular numerals + mono uppercase labels"
```

---

### Task 4: Hero — copy, bracket-tag eyebrow, dither wash, dither CTA

**Files:**
- Modify: `landing/src/components/home/Hero/Hero.tsx`, `landing/src/components/WaitlistForm/WaitlistForm.tsx`, `landing/src/app/globals.css`

**Interfaces:**
- Consumes: `DitherGradient`, `DitherButton` from Task 2.
- Produces: `.htag`, `.hero-wash`, `.btn-dither` CSS classes; DitherButton CTA everywhere WaitlistForm is used (hero, pricing ×2, footer).

- [ ] **Step 1: Hero copy** — in `Hero.tsx`, replace the eyebrow div, `<h1>`, and `.lead` with:

```tsx
<div className="htags" aria-label="macOS app, runs 100 percent locally, launching soon">
  <span className="htag">[macOS]</span>
  <span className="htag">[100% LOCAL]</span>
  <span className="htag">[LAUNCHING SOON]</span>
</div>
<h1>Flaky agents aren&rsquo;t a model problem. They&rsquo;re a prompt problem.</h1>
<p className="lead">
  The <span className="mono-inline">CLAUDE.md</span> you wrote six weeks ago is sabotaging today&rsquo;s runs. Prompt
  Janitor hunts down every rotting prompt file on your Mac, grades it A&ndash;F, and hands you the fix &mdash;
  dependable agents, fewer retries, fewer tokens.
</p>
```

Also add to `globals.css` (and reuse for the existing inline mono spans):

```css
.mono-inline { font-family: var(--mono); font-size: .92em; }
.htags { display: flex; flex-wrap: wrap; gap: 10px; font-family: var(--mono); font-size: 12.5px; font-weight: 500; letter-spacing: .05em; color: var(--blue-press); }
```

- [ ] **Step 2: Dither wash** — in `Hero.tsx` add as first child of `<header className="hero">`:

```tsx
<DitherGradient from="blue" direction="down" cell={3} opacity={0.3} className="hero-wash" aria-hidden="true" />
```

with import `import { DitherGradient } from "@/components/dither-kit/gradient";` (adjust path to actual install). In `globals.css`, DELETE the whole `.hero::before { … }` rule and add:

```css
.hero-wash { position: absolute; inset: 0 0 auto 0; height: 420px; z-index: -1; pointer-events: none; }
```

(If the `direction` reads wrong in the browser — solid edge at the bottom instead of the top — flip to the value that puts solid blue at the top dissolving downward.)

- [ ] **Step 3: DitherButton CTA** — in `WaitlistForm.tsx`, replace the submit `<button className="btn">` with:

```tsx
<DitherButton className="btn-dither" type="submit" disabled={status === "busy"} color="blue" variant="gradient" bloom="low">
  {buttonLabel}
</DitherButton>
```

import from the installed button path. Add CSS:

```css
.btn-dither { font: inherit; font-size: 15.5px; font-weight: 600; padding: 12px 22px; border-radius: var(--r-sm); color: #fff; border: none; cursor: pointer; }
.wl-form.compact .btn-dither { flex: 1 1 100%; }
```

- [ ] **Step 4: Verify** — build + test pass; dev-server: hero shows dithered blue wash, bracket tags, new headline; all four waitlist CTAs render dithered and still submit (submit the hero form with a bogus email → inline error message still appears).

- [ ] **Step 5: Commit**

```bash
git add landing/src/components/home/Hero landing/src/components/WaitlistForm landing/src/app/globals.css
git commit -m "feat(landing): pain-first hero + dither wash + dithered CTAs"
```

---

### Task 5: Outcomes — defect-tax copy + dithered lead card

**Files:**
- Modify: `landing/src/components/home/Outcomes/Outcomes.tsx`, `landing/src/app/globals.css`

**Interfaces:**
- Consumes: `DitherGradient`, `Sparkline`.

- [ ] **Step 1: Section head copy**:

```tsx
<h2>Rotting prompts are a tax you pay on every run</h2>
<p>Every defect charges you again on every task, in every repo — in tokens, in extra turns, in your own review time. Here&rsquo;s the bill.</p>
```

- [ ] **Step 2: Lead card** — kicker `The defect tax` (renders uppercase via CSS), title/body:

```tsx
<div className="oc-card oc-lead">
  <DitherGradient from="blue" direction="left" cell={3} opacity={0.16} className="oc-wash" aria-hidden="true" />
  <div className="oc-body">
    <div className="oc-kicker">The defect tax</div>
    <div className="oc-stat num">+36.8k tokens</div>
    <h3>One missing example = +36.8k tokens. Per task.</h3>
    <p>
      In our first controlled runs, one missing example cost an average of 36,759 extra tokens per task. Same task, same
      agent, one defect apart. Every prompt defect is a recurring bill: it charges you again on every run, in every repo.
      Finding and fixing defects is the cheapest optimization you haven&rsquo;t done — and it&rsquo;s exactly what the scan hands you.
    </p>
    <Sparkline data={[9, 11, 10, 14, 19, 26, 36.8]} color="blue" variant="gradient" animate={false} className="oc-spark" aria-hidden="true" />
  </div>
</div>
```

CSS: remove `background: linear-gradient(...)` from `.oc-lead`, add:

```css
.oc-lead { position: relative; overflow: hidden; }
.oc-wash { position: absolute; inset: 0; pointer-events: none; }
.oc-body { position: relative; }
.oc-spark { display: block; width: 220px; height: 44px; margin-top: 14px; }
```

- [ ] **Step 3: Other card titles** — `"Less babysitting after the run"` → **"Stop babysitting the output"**; `"Agents converge faster"` → **"Stop watching agents wander"**. Bodies and roadmap cards unchanged.

- [ ] **Step 4: Verify** (build/test/dev-eyeball) and **commit** `feat(landing): outcomes defect-tax copy + dithered lead card`.

---

### Task 6: Evidence sparklines, pricing header wash, FooterCta

**Files:**
- Modify: `EvidenceStrip.tsx`, `Pricing.tsx`, `FooterCta.tsx` (under `landing/src/components/home/…`), `landing/src/app/globals.css`

- [ ] **Step 1: EvidenceStrip** — inside each `.ev-stat`, after the `.l` div, add a decorative sparkline (data shaped like the metric's story):

```tsx
<Sparkline data={[8, 10, 9, 13, 18, 25, 36]} color="red" variant="gradient" animate={false} className="ev-spark" aria-hidden="true" />   // +36k tokens
<Sparkline data={[1.2, 1.5, 1.4, 1.8, 2.0]} color="orange" variant="gradient" animate={false} className="ev-spark" aria-hidden="true" /> // +0.8 turns
<Sparkline data={[2.2, 2.0, 1.6, 1.1, 0.8]} color="green" variant="gradient" animate={false} className="ev-spark" aria-hidden="true" /> // −0.4 issues
```

```css
.ev-spark { display: block; width: 100%; height: 36px; margin-top: 12px; }
```

- [ ] **Step 2: Pricing header** — in both `.price-top` divs add `<DitherGradient from="blue" direction="up" cell={3} opacity={0.12} className="price-wash" aria-hidden="true" />`, make `.price-top { position: relative; overflow: hidden; }`, `.price-wash { position: absolute; inset: 0; pointer-events: none; }`, and wrap existing children in `<div className="price-top-body">` with `position: relative`. Remove the `.price-top` linear-gradient background.

- [ ] **Step 3: FooterCta** — copy + backdrop:

```tsx
<h2>Stop blaming the model.</h2>
<p>Fix the files it reads. Waitlist members launch first, at early-bird pricing.</p>
```

Add `<DitherGradient from="blue" direction="up" cell={4} opacity={0.25} className="fcta-wash" aria-hidden="true" />` as first child of the section, section gets `position: relative; overflow: hidden;`, wash `position: absolute; inset: auto 0 0 0; height: 320px; pointer-events: none; z-index: -1;`.

- [ ] **Step 4: Verify** and **commit** `feat(landing): dithered evidence sparklines, pricing wash, footer CTA copy`.

---

### Task 7: Remaining pain-first copy — TagStrip, FeatureRows, Audience

**Files:**
- Modify: `TagStrip.tsx`, `FeatureRows.tsx`, `Audience.tsx`

- [ ] **Step 1: TagStrip head**:

```tsx
<h2>Right now, you&rsquo;re flying blind.</h2>
<p>No linter, no review, no grade for the files your agents read on every single run. Prompt Janitor is the missing instrument panel.</p>
```

- [ ] **Step 2: FeatureRows h3s** (bodies unchanged):
1. `<h3>&ldquo;Is this prompt any good?&rdquo; Stop guessing.</h3>`
2. `<h3>Find the rot before your agent trips on it</h3>`
3. `<h3>House rules die in Slack threads. Not anymore.</h3>`
4. `<h3>Not another dashboard to babysit</h3>`

- [ ] **Step 3: Audience persona `<p>`s**:
- Solo developers: `Your one CLAUDE.md drifts while you ship. Keep it sharp without thinking about it.`
- Eng teams & leads: `You can&rsquo;t review every repo&rsquo;s prompt files. Now you don&rsquo;t have to.`
- AI engineers: `Vibes aren&rsquo;t a standard. Hold your agent prompts to a measurable one.`
- Agencies: `Prove the quality of client prompt files — with grades, not promises.`
- Indie hackers: `Ship fast without your prompts quietly rotting under you.`
- Anyone, really: unchanged.

- [ ] **Step 4: Verify** and **commit** `feat(landing): pain-first copy for tagstrip, features, audience`.

---

### Task 8: Sharpen buttons/inputs, tint texture, mockup dither, reduced motion

**Files:**
- Modify: `landing/src/app/globals.css`

- [ ] **Step 1: Ghost buttons & inputs** — `.btn.ghost`: `border-radius: var(--r-sm); border-color: rgba(15,17,21,.25);`. `.wl-form input[type="email"]`: `border-radius: var(--r-sm);`. `.btn` (remaining non-dither uses, e.g. nav): `border-radius: var(--r-sm);`.

- [ ] **Step 2: Tint texture** — add a sparse dot field to `.section.tint`:

```css
.section.tint {
  background-color: var(--bg-tint);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Ccircle cx='1' cy='1' r='0.7' fill='rgba(15,17,21,0.05)'/%3E%3C/svg%3E");
}
```

- [ ] **Step 3: Mockup dither fills** — `.mk-bar > i`: replace the smooth gradient with a dithered stripe:

```css
.mk-bar > i { background: var(--blue); background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Crect x='0' y='0' width='1' height='1' fill='rgba(255,255,255,0.5)'/%3E%3Crect x='2' y='2' width='1' height='1' fill='rgba(255,255,255,0.5)'/%3E%3C/svg%3E"); }
```

`.mk-ring`: keep conic gradient but overlay the same 4×4 checker pattern via an extra `background-image` layer.

- [ ] **Step 4: Reduced motion** — confirm every `Sparkline` uses `animate={false}` and DitherButton/Gradient respect `prefers-reduced-motion` (check vendored source; if they animate unconditionally, gate with a wrapper class + the existing reduced-motion media query).

- [ ] **Step 5: Verify** and **commit** `feat(landing): sharpened controls, dither textures in tint sections and mockups`.

---

### Task 9: Full verification, STATUS update, PR

- [ ] **Step 1: Full check**

```bash
pnpm --dir landing test        # vitest: all pass
pnpm --dir landing build       # next build: succeeds
```

- [ ] **Step 2: Visual pass** — `pnpm --dir landing dev`, screenshot the full page (Playwright browser tools or manual), check: hero wash, mono numerals, dithered CTAs, sparklines, contrast/readability, mobile width (resize to 390px).

- [ ] **Step 3: STATUS dashboard** (project CLAUDE.md mandate) — edit `docs/status/data.json`: append to `recent`: `2026-07-22 — Landing reskin: pain-first copy + Tailwind/shadcn/dither-kit visual identity (PR pending)`. Then `pnpm status` and commit both files.

- [ ] **Step 4: Push + PR**

```bash
git push -u origin feat/landing-dither-reskin
gh pr create --title "feat(landing): pain-first copy + dither-kit nerd reskin" --body "$(cat <<'EOF'
## Summary
- Pain-first copy across hero, outcomes, tagstrip, features, audience, footer CTA (spec: docs/superpowers/specs/2026-07-22-landing-nerd-reskin-design.md)
- Tailwind v4 (no preflight) + shadcn scaffolding + vendored dither-kit components
- DitherGradient washes (hero, outcomes lead, pricing, footer), DitherButton CTAs, dithered sparklines, mono tabular numerals

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Notes

- Spec coverage: copy (Tasks 4–7), typography (3), stack+components (1–2), dither applications (4–6, 8), acceptance (9). Avatar component: spec marks it optional "only if it earns its place" — intentionally not installed (YAGNI).
- Dither-kit component paths/props verified against the live registry (gradient.json, button.json, area-chart.json) on 2026-07-22; Step "inspect installed files" guards against drift.
- Types: `cn` only consumed by vendored components; Sparkline `data: number[]` matches usage.
