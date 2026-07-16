# Pre-launch Marketing Site — Design

**Date:** 2026-07-16 (rev 2 — stack switched to Next.js/Vercel at owner request)
**Status:** Approved (brainstorm with owner)
**Goal:** Let the public judge the idea before committing more dev. Ship a proper
pre-launch website, post to socials, measure traction. Dev on Plans 2–4 of the
benchmark epic resumes only if traction is good (see `docs/BENCHMARK_STATUS.md`).

## Decisions (made with owner)

| Decision | Choice |
|---|---|
| Primary CTA | **Waitlist-first, pricing visible** — every CTA joins the waitlist; $69 founder price stays visible framed as "lock in founder pricing at launch" |
| Analytics | **Google Analytics 4 only** (`G-RX37WJZFSQ`) |
| Blog angles | Craft guides, evidence/benchmark story, philosophy/manifesto |
| Site scope | Landing + blog section (no multi-page split) |
| Stack | **Next.js (App Router) on Vercel** — replaces the Vite static site AND the separate waitlist backend: the Resend call runs in a same-origin API route, so no Cloudflare Worker is needed (owner decision 2026-07-16, superseding the earlier Astro + Worker choice) |

## Architecture

### Next.js site (replaces `landing/` Vite site)

- Same `landing/` directory, still **its own pnpm workspace root** (own
  `pnpm-workspace.yaml`), Next.js 15 App Router + TypeScript, `src/` layout.
- **Pages:**
  - `src/app/page.tsx` — the landing page (structure below), sections as React
    components under `src/components/` following the repo component convention
    (folder per component: `index.ts` + `Component.tsx` + `.types.ts` when the
    component has props)
  - `src/app/blog/page.tsx` — post list
  - `src/app/blog/[slug]/page.tsx` — statically generated from markdown in
    `landing/content/blog/*.md` (frontmatter: `title`, `description`,
    `pubDate`, `tags`, `draft`; parsed with gray-matter + remark)
  - `src/app/thanks/page.tsx` — kept for the eventual Polar flow
  - `src/app/rss.xml/route.ts` + `src/app/sitemap.ts` — RSS and sitemap
  - Field guide: keep the existing generator
    (`landing/scripts/build-field-guide.mjs`, source
    `docs/standards/prompting-standards.md`) emitting a self-contained
    `public/field-guide.html`. No rewrite.
- **Styling:** the existing `styles.css` visual identity moves verbatim to
  `src/app/globals.css` (plus additive sections for new components). Re-skin of
  markup into JSX, not a redesign. No CSS framework.
- **Deploy:** **Vercel** git integration (project root directory = `landing/`).
  The GitHub Pages workflow (`.github/workflows/landing.yml`) is deleted; the
  CI build-check job for `landing/` stays. Custom domain `promptjanitor.app`
  configured in Vercel; canonical URLs/RSS/sitemap use it.
  - Note: Vercel Hobby tier is nominally non-commercial; acceptable for the
    pre-launch test, revisit (Pro, $20/mo) if traction is good.

### Waitlist — Next.js API route (no separate backend)

`POST /api/subscribe` (same origin — no CORS), body `{ email, source }`
(`source` = which CTA: hero, pricing-free, pricing-pro, footer, blog-<slug>).

- Validate email → via Resend REST API, send two emails (no Resend Audience —
  owner decision 2026-07-16):
  1. **Confirmation email to the subscriber** from
     `prompt-janitor@studiotristar.com` — "you're on the list", branded.
  2. **Notification email to the owner** (`prompt-janitor@studiotristar.com`,
     subject includes subscriber email + `source`) so the owner can manually
     maintain the Excel of interested people.
- `RESEND_API_KEY` lives in a Vercel environment variable (and `.env.local`
  for dev) — never in client code.
- Honeypot field for bots (silent fake success). Duplicate emails are a
  silent success.
- Landing form: email input in hero, repeated at pricing and footer; inline
  success/error states (no page navigation).

### Analytics — GA4

- `@next/third-parties` `<GoogleAnalytics gaId="G-RX37WJZFSQ" />` in the root
  layout, production builds only.
- Custom events: `waitlist_submit` (with `source`), `cta_click`.
- UTM convention for social posts, documented in the repo:
  `utm_source=x|linkedin|reddit|hn`, `utm_medium=social`,
  `utm_campaign=prelaunch`.

## Landing page structure

1. **Hero** — "Know in 10 seconds if your prompts are good enough."
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
checkout on the page (Polar wiring stays out of scope; the thanks page is
kept). The placeholder "Featured on" badge strip is removed.

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
- **Custom domain:** `promptjanitor.app`

Still needed to go live (not to build):

- A Vercel account with the repo imported (project root directory =
  `landing/`), and `RESEND_API_KEY` set as a Vercel environment variable.
- `studiotristar.com` verified as a sending domain in Resend.
- DNS for `promptjanitor.app` pointed at Vercel (Vercel dashboard shows the
  records).

## Out of scope

- Real Polar checkout wiring, macOS download link (stays until launch).
- Any app (`src/`, `src-tauri/`) or fulfillment worker changes.
- Benchmark powered run / Plans 2–4 (gated on traction).

## Error handling

- Waitlist form: client-side email validation; API route returns 400 (bad
  email/body), honeypot silently returns success, 503 if `RESEND_API_KEY` is
  unset, 502 if Resend rejects the send (logged server-side); network failure
  in the form shows a `mailto:` fallback message.

## Testing / verification

- `next build` locally; `next start` and check landing, blog index, each post,
  RSS, sitemap, thanks, field guide.
- API route: vitest unit tests on the pure validation/email-builder modules;
  curl `POST /api/subscribe` happy/invalid/honeypot paths against `next dev`
  (dummy key → 502 proves wiring); then one real end-to-end signup on the
  deployed site with a test email → confirmation + owner notification received.
- GA4: DebugView shows pageview + `waitlist_submit` with `source`.
- Deploy: Vercel preview build green; live site spot-check on mobile viewport.
