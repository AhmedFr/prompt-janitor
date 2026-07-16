# Pre-launch Marketing Site — Design

**Date:** 2026-07-16
**Status:** Approved (brainstorm with owner)
**Goal:** Let the public judge the idea before committing more dev. Ship a proper
pre-launch website, post to socials, measure traction. Dev on Plans 2–4 of the
benchmark epic resumes only if traction is good (see `docs/BENCHMARK_STATUS.md`).

## Decisions (made with owner)

| Decision | Choice |
|---|---|
| Primary CTA | **Waitlist-first, pricing visible** — every CTA joins the waitlist; $69 founder price stays visible framed as "lock in founder pricing at launch" |
| Analytics | **Google Analytics 4 only** |
| Blog angles | Craft guides, evidence/benchmark story, philosophy/manifesto |
| Site scope | Landing + blog section (no multi-page split) |
| Stack | **Migrate `landing/` to Astro** (chosen over extending the Vite static site) |

## Architecture

### Astro site (replaces `landing/` Vite site)

- Same `landing/` directory, still **outside the pnpm workspace**
  (`pnpm install --ignore-workspace`), static output (`output: 'static'`).
- **Pages:**
  - `src/pages/index.astro` — the landing page (structure below)
  - `src/pages/blog/index.astro` — post list
  - `src/pages/blog/[slug].astro` — posts from a content collection
    (`src/content/blog/*.md`; schema: `title`, `description`, `pubDate`,
    `tags`, `draft`)
  - `src/pages/thanks.astro` — kept for the eventual Polar flow
  - Field guide: keep the existing generator
    (`landing/scripts/build-field-guide.mjs`, source
    `docs/standards/prompting-standards.md`) emitting to
    `public/field-guide.html`. No rewrite.
- **Astro extras:** `@astrojs/rss` feed, `@astrojs/sitemap`, per-page SEO +
  OpenGraph meta (needed for social link previews).
- **Styling:** port the current visual identity from `landing/src/styles.css`
  into an Astro base layout + components. Re-skin of markup, not a redesign.
  No CSS framework; hand-rolled CSS stays.
- **Deploy:** update `.github/workflows/landing.yml` to build Astro → GitHub
  Pages. Same trigger: push to `main`, path-filtered to `landing/**`.

### Waitlist — standalone `waitlist/` Cloudflare Worker

Deliberately **separate** from the fulfillment worker (`fulfillment/`, unmerged
PR #95) so marketing is not coupled to unfinished dev. Reuse its patterns
(wrangler config, Resend client shape) where sensible.

- `POST /subscribe` — body `{ email, source }` (`source` = which CTA: hero,
  pricing-free, pricing-pro, footer, blog-<slug>).
- Validate email → via Resend, send two emails (no Resend Audience — owner
  decision 2026-07-16):
  1. **Confirmation email to the subscriber** from
     `prompt-janitor@studiotristar.com` — "you're on the list", branded.
  2. **Notification email to the owner** (`prompt-janitor@studiotristar.com`,
     subject includes subscriber email + `source`) so the owner can manually
     maintain the Excel of interested people.
- CORS locked to the site origin. Honeypot field for bots. Duplicate emails are
  a silent success (Resend dedupes).
- Landing form: email input in hero, repeated at pricing and footer; inline
  success/error states (no page navigation).

### Analytics — GA4

- gtag snippet in the Astro base layout (all pages).
- Custom events: `waitlist_submit` (with `source`), `cta_click`.
- UTM convention for social posts, documented in the repo:
  `utm_source=x|linkedin|reddit|hn`, `utm_medium=social`,
  `utm_campaign=prelaunch`.

## Landing page structure

1. **Hero** — "Know in 10 seconds whether your prompts are good enough."
   Sub: prompt files (`CLAUDE.md`, `AGENTS.md`, `.cursorrules`) are
   infrastructure nobody inspects; Prompt Janitor scans, grades A–F, tells you
   what to fix. CTA: email field → **Join the waitlist**.
2. **Evidence teaser** — honest benchmark framing: "In our first controlled
   runs, a single prompt defect cost on average +36k tokens and +0.8 extra
   turns per task. We're building the benchmark to prove it at scale." Links
   to the benchmark blog post. Must not overclaim (N=5, not significant).
3. **How it works** — Scan → Grade → Treat, mapped to Diagnosis (free) /
   Treatment (Pro).
4. **Features grid** — verdict-first Overview dashboard; deterministic fact
   rules with cited findings; 25-standard AI catalog (free, bring your own
   compute); custom rules in plain English; template packs (Pro); 100% local.
5. **Philosophy strip** — short manifesto excerpt; links to the philosophy post.
6. **Pricing** — keep Free Diagnosis / Pro Treatment $69 founder (struck $99).
   Both buttons become "Join the waitlist — lock in founder pricing"; the
   clicked tier is captured in the waitlist `source`.
7. **FAQ** — add "When does it launch?" and "What happens when I join the
   waitlist?"; keep local-first/privacy answers; drop/soften anything implying
   the app is downloadable today.
8. **Footer** — waitlist repeat, blog + RSS links.

Dead CTAs removed: no `href="#"` download button, no placeholder Polar
checkout on the page (Polar wiring stays out of scope; `thanks.html` kept).

## Launch blog batch (3 posts, fully drafted, owner edits voice)

1. **"The 7 defects that quietly poison your agent's context"** — craft guide;
   each defect grounded in the 25-standard catalog
   (`docs/standards/prompting-standards.md`) with citations.
2. **"We measured what a bad prompt actually costs"** — benchmark methodology
   + early numbers with the honest N=5/not-yet-significant caveat, and what
   the powered run will show. Sources: `docs/BENCHMARK_STATUS.md`,
   `benchmark/effects.json`, the benchmark design spec.
3. **"Diagnosis should be free"** — the manifesto: prompts as unmanaged
   infrastructure; why scanning/grading has no caps; what treatment means.

Every post ends with the waitlist CTA (with `source=blog-<slug>`).

## Owner-provided inputs

Provided 2026-07-16:

- **GA4 measurement ID:** `G-RX37WJZFSQ`
- **Sender/notification email:** `prompt-janitor@studiotristar.com` (no Resend
  Audience; owner tracks signups manually in Excel from the notification
  emails)
- **Custom domain:** `promptjanitor.app` — GitHub Pages custom domain
  (`CNAME` file in the site's `public/`), Astro `site:
  "https://promptjanitor.app"` for canonical URLs/RSS/sitemap.

Still needed to go live (not to build):

- Resend API key as a worker secret; `studiotristar.com` verified as a sending
  domain in Resend.
- Cloudflare account creds for deploying `waitlist/` worker.
- DNS for `promptjanitor.app` pointed at GitHub Pages.

## Out of scope

- Real Polar checkout wiring, macOS download link (stays until launch).
- Any app (`src/`, `src-tauri/`) or fulfillment worker changes.
- Benchmark powered run / Plans 2–4 (gated on traction).

## Error handling

- Waitlist form: client-side email validation; worker returns 400 (bad email),
  429-ish behavior via honeypot silently dropping bots; network failure shows
  a retry message with a `mailto:` fallback.
- Worker → Resend failure: return 502 with a friendly message; log to worker
  console (visible in Cloudflare dashboard).

## Testing / verification

- `astro build` + `astro preview` locally; check landing, blog index, one post,
  RSS, sitemap, field guide.
- Worker: `wrangler dev` locally, curl `POST /subscribe` happy/invalid/honeypot
  paths; then a real end-to-end signup against deployed worker with a test
  email → contact appears in Resend Audience + welcome email received.
- GA4: DebugView shows pageview + `waitlist_submit` with `source`.
- Deploy: Pages workflow green; live site spot-check on mobile viewport.
