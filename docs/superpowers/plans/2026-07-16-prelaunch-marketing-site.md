# Pre-launch Marketing Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `landing/` to Astro with a waitlist-first landing page, a 3-post blog, GA4 analytics, and a standalone Cloudflare Worker that emails waitlist signups via Resend — so the owner can post on socials and measure traction before committing more dev.

**Architecture:** Astro 5 static site (same `landing/` dir, GitHub Pages, custom domain `promptjanitor.app`) replaces the Vite site; markup is decomposed into single-responsibility `.astro` components reusing the existing `styles.css` design verbatim. A new `waitlist/` Cloudflare Worker exposes `POST /subscribe` and sends two Resend emails (subscriber confirmation + owner notification — no Resend Audience). Blog posts are markdown content collections with RSS + sitemap.

**Tech Stack:** Astro ^5, @astrojs/rss, @astrojs/sitemap, Cloudflare Workers (wrangler ^4, TypeScript), Resend REST API, GA4 (gtag), pnpm.

**Spec:** `docs/superpowers/specs/2026-07-16-prelaunch-marketing-site-design.md`

## Global Constraints

- Package manager: **pnpm**. `landing/` and `waitlist/` are each their own pnpm workspace root (each contains its own `pnpm-workspace.yaml`), isolated from the app workspace.
- **GA4 measurement ID:** `G-RX37WJZFSQ` (exact).
- **Domain:** `https://promptjanitor.app` (exact — Astro `site`, canonical URLs, `public/CNAME`).
- **Sender/notification email:** `prompt-janitor@studiotristar.com` (exact). No Resend Audience — two plain emails per signup.
- **Pricing copy:** Pro is **$69** (struck `$99`), "Founder pricing · one-time", `$29/yr` optional renewal. Never change these numbers.
- **Benchmark honesty rule:** every mention of benchmark numbers MUST carry the N=5 / not-yet-significant caveat. Never write "proven".
- **No changes** to `src/`, `src-tauri/`, `fulfillment/`, or `benchmark/`.
- One clear responsibility per file; landing sections are separate `.astro` components.
- The base branch is `feat/prelaunch-site` (already contains the merged PR #89 landing at commit `8af1c11`). All line-range references to `landing/index.html`, `landing/thanks.html` refer to that state.
- Blog slugs (exact, used in links before the posts exist): `seven-defects-that-poison-your-agents-context`, `what-a-bad-prompt-actually-costs`, `diagnosis-should-be-free`.
- Waitlist `source` values (exact): `hero`, `pricing-free`, `pricing-pro`, `footer`, `blog-<slug>`.

---

### Task 1: Astro scaffold in `landing/`

Replace the Vite toolchain with Astro; keep the design system CSS. Ends with a building (placeholder) site.

**Files:**
- Create: `landing/astro.config.mjs`
- Create: `landing/src/consts.ts`
- Create: `landing/src/layouts/Base.astro`
- Create: `landing/src/styles/global.css` (moved from `landing/src/styles.css`)
- Create: `landing/src/pages/index.astro` (placeholder, replaced in Task 2)
- Create: `landing/public/CNAME`
- Modify: `landing/package.json` (full rewrite below)
- Modify: `.gitignore` (add `.astro/`)
- Delete: `landing/vite.config.js`, `landing/src/styles.css` (moved), `landing/src/main.js` (its 3 jobs die or move: Polar wiring is removed per spec; FAQ accordion moves into `Faq.astro` in Task 2; footer year is computed at build time in `Footer.astro`)

**Interfaces:**
- Produces: `Base.astro` with props `{ title: string; description: string; ogType?: string; noindex?: boolean }` — every page renders inside it; it owns `<head>` (SEO + GA4), skip-link, and imports `global.css`. `consts.ts` exports `SITE_TITLE`, `SITE_URL`, `GA_ID`, `WAITLIST_ENDPOINT`, `CONTACT_EMAIL`.

- [ ] **Step 1: Rewrite `landing/package.json`**

```json
{
  "name": "prompt-janitor-landing",
  "private": true,
  "version": "0.2.0",
  "type": "module",
  "description": "Marketing site for Prompt Janitor (Astro static site).",
  "scripts": {
    "dev": "astro dev",
    "build": "node scripts/build-field-guide.mjs && astro build",
    "preview": "astro preview",
    "build:guide": "node scripts/build-field-guide.mjs"
  },
  "dependencies": {
    "astro": "^5.12.0",
    "@astrojs/rss": "^4.0.12",
    "@astrojs/sitemap": "^3.4.1"
  }
}
```

Note `build` chains the field-guide generator first — this keeps the existing CI and Pages workflows working without modification.

- [ ] **Step 2: Create `landing/astro.config.mjs`**

```js
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://promptjanitor.app",
  integrations: [sitemap()],
});
```

- [ ] **Step 3: Move the stylesheet**

```bash
mkdir -p landing/src/styles landing/src/layouts landing/src/pages landing/src/components
git mv landing/src/styles.css landing/src/styles/global.css
```

- [ ] **Step 4: Create `landing/src/consts.ts`**

```ts
export const SITE_TITLE = "Prompt Janitor";
export const SITE_URL = "https://promptjanitor.app";
export const GA_ID = "G-RX37WJZFSQ";
// TODO(deploy): replace with the real workers.dev URL printed by `wrangler deploy`
// (or a custom route). The form fails gracefully until then.
export const WAITLIST_ENDPOINT = "https://pj-waitlist.YOUR-SUBDOMAIN.workers.dev/subscribe";
export const CONTACT_EMAIL = "prompt-janitor@studiotristar.com";
```

- [ ] **Step 5: Create `landing/src/layouts/Base.astro`**

```astro
---
import "../styles/global.css";
import { GA_ID, SITE_URL } from "../consts";

interface Props {
  title: string;
  description: string;
  ogType?: string;
  noindex?: boolean;
}
const { title, description, ogType = "website", noindex = false } = Astro.props;
const canonical = new URL(Astro.url.pathname, SITE_URL).href;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title}</title>
    <meta name="description" content={description} />
    {noindex && <meta name="robots" content="noindex" />}
    <meta name="theme-color" content="#0a84ff" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="canonical" href={canonical} />
    <link rel="alternate" type="application/rss+xml" title="Prompt Janitor Blog" href="/rss.xml" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content={ogType} />
    <meta property="og:url" content={canonical} />
    {import.meta.env.PROD && (
      <>
        <script is:inline async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}></script>
        <script is:inline define:vars={{ GA_ID }}>
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag("js", new Date());
          gtag("config", GA_ID);
        </script>
      </>
    )}
  </head>
  <body>
    <a href="#main" class="skip-link">Skip to content</a>
    <slot />
    <script>
      declare global {
        interface Window { gtag?: (...args: unknown[]) => void; }
      }
      document.addEventListener("click", (e) => {
        const a = (e.target as Element).closest?.("a.btn, a.ev-link");
        if (a) window.gtag?.("event", "cta_click", { href: a.getAttribute("href") ?? "" });
      });
    </script>
  </body>
</html>
```

(Nav and Footer are page-level components added in Task 2 — `thanks` and blog pages reuse them explicitly. Base owns only head/skip-link/analytics.)

- [ ] **Step 6: Create placeholder `landing/src/pages/index.astro`**

```astro
---
import Base from "../layouts/Base.astro";
---
<Base
  title="Prompt Janitor — Grade every prompt on your Mac"
  description="Prompt Janitor scans every AGENTS.md and CLAUDE.md on your Mac and grades them A–F. Pre-launch — join the waitlist."
>
  <main id="main">
    <h1>Prompt Janitor</h1>
  </main>
</Base>
```

- [ ] **Step 7: Create `landing/public/CNAME`** — file content is the single line:

```
promptjanitor.app
```

- [ ] **Step 8: Delete Vite leftovers, add `.astro/` to root `.gitignore`**

```bash
git rm landing/vite.config.js landing/src/main.js
```

In `/.gitignore`, after the `dist-ssr/` line add:

```
.astro/
```

- [ ] **Step 9: Install and build**

```bash
cd landing && pnpm install && pnpm build
```

Expected: `astro build` succeeds (the field-guide script may still emit `landing/field-guide.html` at repo state — fine for now, fixed in Task 2); `landing/dist/index.html` exists and contains `googletagmanager.com/gtag/js?id=G-RX37WJZFSQ` and `<link rel="canonical" href="https://promptjanitor.app/"`.

```bash
grep -o "G-RX37WJZFSQ" dist/index.html | head -1
grep -o 'rel="canonical" href="https://promptjanitor.app/"' dist/index.html
cat dist/CNAME
```

- [ ] **Step 10: Commit**

```bash
git add -A landing .gitignore
git commit -m "feat(landing): Astro 5 scaffold — Base layout, GA4, promptjanitor.app canonical + CNAME"
```

---

### Task 2: Port the existing pages to Astro components (visual parity)

Decompose the current `landing/index.html` (commit `8af1c11`) into components with **unchanged markup** (exception: the placeholder "Featured on" section is dropped per spec). Port `thanks.html`. Point the field-guide generator at `public/`.

**Files:**
- Create: `landing/src/components/Nav.astro`, `Footer.astro`
- Create: `landing/src/components/home/Hero.astro`, `TagStrip.astro`, `FeatureRows.astro`, `MiniCards.astro`, `Audience.astro`, `Pricing.astro`, `Faq.astro`, `FooterCta.astro`
- Modify: `landing/src/pages/index.astro`
- Create: `landing/src/pages/thanks.astro`
- Modify: `landing/scripts/build-field-guide.mjs`
- Delete: `landing/index.html`, `landing/thanks.html`, `landing/field-guide.html` (generator output relocates to `public/`)

**Interfaces:**
- Consumes: `Base.astro` from Task 1.
- Produces: `Nav.astro` and `Footer.astro` (no props) used by every page; `home/*` section components (no props) composed by `index.astro`. All internal anchor hrefs become absolute (`/#features`, `/#pricing`, `/#faq`, `/#hero`) so they work from blog pages.

- [ ] **Step 1: Create `Nav.astro` and `Footer.astro`**

`Nav.astro`: move lines 25–38 of `landing/index.html` verbatim, then make hrefs absolute: `#hero`→`/#hero`, `#features`→`/#features`, `#pricing`→`/#pricing`, `#faq`→`/#faq` (5 hrefs total including the Download button).

`Footer.astro`: move lines 270–286 verbatim; make the same href replacements; replace the static year span with a build-time year — frontmatter `const year = new Date().getFullYear();` and `<span>© {year} Prompt Janitor — All rights reserved</span>`.

- [ ] **Step 2: Create the eight `home/` section components** by moving these line ranges of `landing/index.html` verbatim (one component per section, no markup edits):

| Component | index.html lines | Section |
|---|---|---|
| `home/Hero.astro` | 42–61 | `<header class="hero">` |
| `home/TagStrip.astro` | 64–81 | "Visibility you've never had" |
| `home/FeatureRows.astro` | 84–124 | alternating features |
| `home/MiniCards.astro` | 127–146 | `.cards2` |
| `home/Audience.astro` | 149–164 | audience grid |
| `home/Pricing.astro` | 167–220 | pricing + guarantee |
| `home/Faq.astro` | 223–243 | FAQ accordion |
| `home/FooterCta.astro` | 259–266 | "Grade once. Stay sharp." |

Lines 246–256 ("Featured on" placeholder badges) are **not ported** — deleted per spec.

At the end of `Faq.astro`, add the accordion behavior (previously in `main.js`):

```astro
<script>
  document.querySelectorAll<HTMLButtonElement>(".acc-q").forEach((q) => {
    q.addEventListener("click", () => {
      const acc = q.parentElement!;
      const open = acc.classList.toggle("open");
      q.setAttribute("aria-expanded", String(open));
    });
  });
</script>
```

The Polar wiring from `main.js` is intentionally NOT ported (spec: no Polar on the page). In `Pricing.astro`, change the Pro button line (index.html line 208) to a plain anchor for now (rewired to waitlist in Task 5):

```html
<a class="btn" href="/#pricing">Get Pro — $69</a>
```

- [ ] **Step 3: Rewrite `landing/src/pages/index.astro`**

```astro
---
import Base from "../layouts/Base.astro";
import Nav from "../components/Nav.astro";
import Footer from "../components/Footer.astro";
import Hero from "../components/home/Hero.astro";
import TagStrip from "../components/home/TagStrip.astro";
import FeatureRows from "../components/home/FeatureRows.astro";
import MiniCards from "../components/home/MiniCards.astro";
import Audience from "../components/home/Audience.astro";
import Pricing from "../components/home/Pricing.astro";
import Faq from "../components/home/Faq.astro";
import FooterCta from "../components/home/FooterCta.astro";
---
<Base
  title="Prompt Janitor — Grade every prompt on your Mac"
  description="Prompt Janitor scans every AGENTS.md and CLAUDE.md on your Mac and grades them A–F against the industry's own standards — free, forever, on your machine. Fixing them is Pro: a one-time purchase, no subscription."
>
  <Nav />
  <main id="main">
    <Hero />
    <TagStrip />
    <FeatureRows />
    <MiniCards />
    <Audience />
    <Pricing />
    <Faq />
    <FooterCta />
  </main>
  <Footer />
</Base>
```

- [ ] **Step 4: Create `landing/src/pages/thanks.astro`**

Port `landing/thanks.html`: frontmatter imports `Base`, `Nav`, `Footer`; `<Base title="You're in. — Prompt Janitor" description="Thanks for grabbing Prompt Janitor Pro. Your license key is on its way — here's how to activate it." noindex>`; body = `<Nav />` + lines 56–82 (`<main>…</main>`) verbatim + `<Footer />`; move the `<style>` block (lines 15–36) into a scoped `<style>` at the end of the component, unchanged.

- [ ] **Step 5: Point the field-guide generator at `public/`**

In `landing/scripts/build-field-guide.mjs`:
1. Change the output path constant from `landing/field-guide.html` to `landing/public/field-guide.html` (the script resolves paths relative to itself — adjust the existing resolve call accordingly).
2. In its HTML template, replace `<link rel="stylesheet" href="/src/styles.css" />` with an inlined stylesheet: read the CSS at build time (`const css = await readFile(new URL("../src/styles/global.css", import.meta.url), "utf8");`) and emit `<style>${css}</style>`.
3. Remove the `<script type="module" src="/src/main.js"></script>` line from the template if present (inline any year-stamping it did with a literal year).

```bash
git rm landing/index.html landing/thanks.html landing/field-guide.html
```

Add `landing/public/field-guide.html` to `landing/.gitignore` (create the file if missing — it's generated output):

```
public/field-guide.html
```

- [ ] **Step 6: Build and verify parity**

```bash
cd landing && pnpm build && pnpm preview --port 4321 &
sleep 2
curl -s http://localhost:4321/ | grep -c "Diagnosis free. Treatment paid."   # expect 1
curl -s http://localhost:4321/ | grep -c "badge-slot"                        # expect 0 (featured-on gone)
curl -s http://localhost:4321/thanks/ | grep -c "Your license key is on its way"  # expect 1
curl -s http://localhost:4321/field-guide.html | grep -c "<style>"           # expect ≥1 (inlined CSS)
kill %1
```

Also open `http://localhost:4321/` in a browser if available and confirm the page looks identical to the pre-migration landing (hero shot, tags, alternating features, pricing cards, FAQ open/close works).

- [ ] **Step 7: Commit**

```bash
git add -A landing
git commit -m "feat(landing): port landing/thanks to Astro components at visual parity; drop featured-on + Polar wiring"
```

---

### Task 3: Blog infrastructure (content collection, layout, index, RSS)

**Files:**
- Create: `landing/src/content.config.ts`
- Create: `landing/src/layouts/BlogPost.astro`
- Create: `landing/src/pages/blog/index.astro`
- Create: `landing/src/pages/blog/[slug].astro`
- Create: `landing/src/pages/rss.xml.js`
- Create: `landing/src/content/blog/.gitkeep` (posts arrive in Tasks 6–8)
- Modify: `landing/src/styles/global.css` (append blog styles)
- Modify: `landing/src/components/Nav.astro`, `Footer.astro` (Blog links)

**Interfaces:**
- Consumes: `Base.astro`, `Nav.astro`, `Footer.astro`.
- Produces: collection `blog` with schema `{ title: string; description: string; pubDate: Date; tags: string[]; draft: boolean }`; layout `BlogPost.astro` with prop `post` (a blog `CollectionEntry`) rendering slotted content; URLs `/blog/`, `/blog/<slug>/`, `/rss.xml`. Tasks 6–8 only add `.md` files.

- [ ] **Step 1: Create `landing/src/content.config.ts`**

```ts
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
```

- [ ] **Step 2: Create `landing/src/layouts/BlogPost.astro`**

```astro
---
import type { CollectionEntry } from "astro:content";
import Base from "./Base.astro";
import Nav from "../components/Nav.astro";
import Footer from "../components/Footer.astro";
import WaitlistForm from "../components/WaitlistForm.astro";

interface Props {
  post: CollectionEntry<"blog">;
}
const { post } = Astro.props;
const { title, description, pubDate } = post.data;
const dateLabel = pubDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
---
<Base title={`${title} — Prompt Janitor`} description={description} ogType="article">
  <Nav />
  <main id="main">
    <article class="section" style="padding-top:64px;">
      <div class="wrap">
        <header class="post-header">
          <div class="eyebrow">Blog · {dateLabel}</div>
          <h1>{title}</h1>
          <p class="lead" style="max-width:600px;margin:20px auto 0;color:var(--ink-2);font-size:19px;">{description}</p>
        </header>
        <div class="prose">
          <slot />
        </div>
        <div class="post-cta">
          <h3 style="font-size:26px;">Prompt Janitor is launching soon</h3>
          <p class="muted" style="margin:12px 0 0;">Scan, grade, and fix every prompt file on your Mac. Waitlist members lock in founder pricing — $69 instead of $99.</p>
          <WaitlistForm source={`blog-${post.id}`} />
        </div>
      </div>
    </article>
  </main>
  <Footer />
</Base>
```

Note: `WaitlistForm.astro` is created in Task 5. To keep this task independently buildable, create a **minimal stub now** at `landing/src/components/WaitlistForm.astro` (Task 5 replaces it entirely):

```astro
---
interface Props { source: string; buttonLabel?: string; compact?: boolean; }
const { source } = Astro.props;
---
<p class="wl-msg" data-source={source}>Waitlist opens soon.</p>
```

- [ ] **Step 3: Create `landing/src/pages/blog/index.astro`**

```astro
---
import { getCollection } from "astro:content";
import Base from "../../layouts/Base.astro";
import Nav from "../../components/Nav.astro";
import Footer from "../../components/Footer.astro";

const posts = (await getCollection("blog", ({ data }) => !data.draft))
  .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
---
<Base
  title="Blog — Prompt Janitor"
  description="Field notes on prompt files, agent context, and measuring what actually works."
>
  <Nav />
  <main id="main">
    <section class="section">
      <div class="wrap" style="max-width:760px;">
        <div class="section-head">
          <div class="eyebrow">Blog</div>
          <h2 style="margin-top:12px;">Field notes on prompt health</h2>
          <p>Practical writing about prompt files, agent context, and evidence over vibes.</p>
        </div>
        <div class="post-list">
          {posts.map((post) => (
            <a class="post-card" href={`/blog/${post.id}/`}>
              <div class="faint post-date">
                {post.data.pubDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </div>
              <h3>{post.data.title}</h3>
              <p class="muted">{post.data.description}</p>
              <span class="post-more">Read →</span>
            </a>
          ))}
          {posts.length === 0 && <p class="muted" style="text-align:center;">First posts landing shortly.</p>}
        </div>
      </div>
    </section>
  </main>
  <Footer />
</Base>
```

- [ ] **Step 4: Create `landing/src/pages/blog/[slug].astro`**

```astro
---
import { getCollection, render } from "astro:content";
import BlogPost from "../../layouts/BlogPost.astro";

export async function getStaticPaths() {
  const posts = await getCollection("blog", ({ data }) => !data.draft);
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}
const { post } = Astro.props;
const { Content } = await render(post);
---
<BlogPost post={post}>
  <Content />
</BlogPost>
```

- [ ] **Step 5: Create `landing/src/pages/rss.xml.js`**

```js
import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

export async function GET(context) {
  const posts = (await getCollection("blog", ({ data }) => !data.draft))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
  return rss({
    title: "Prompt Janitor Blog",
    description: "Field notes on prompt files, agent context, and measuring what actually works.",
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blog/${post.id}/`,
    })),
  });
}
```

- [ ] **Step 6: Append blog styles to `landing/src/styles/global.css`**

```css
/* ---------- blog ---------- */
.post-list { display: flex; flex-direction: column; gap: 18px; }
.post-card { display: block; background: var(--card); border: 1px solid var(--line); border-radius: var(--r-md); box-shadow: var(--shadow-sm); padding: 26px 28px; transition: transform .12s, box-shadow .12s; }
.post-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
.post-card h3 { font-size: 23px; margin: 6px 0 8px; }
.post-card p { margin: 0 0 12px; font-size: 16px; }
.post-date { font-size: 13.5px; }
.post-more { color: var(--blue-press); font-weight: 600; font-size: 15px; }
.post-header { text-align: center; padding: 24px 0 0; }
.post-header h1 { font-size: clamp(34px, 5vw, 54px); font-weight: 700; letter-spacing: -.03em; max-width: 20ch; margin: 14px auto 0; }
.prose { max-width: 680px; margin: 48px auto 0; font-size: 17.5px; }
.prose h2 { font-size: 28px; margin: 44px 0 14px; }
.prose h3 { font-size: 21px; margin: 32px 0 10px; }
.prose p, .prose li { color: var(--ink-2); line-height: 1.7; }
.prose ul, .prose ol { padding-left: 24px; }
.prose code { font-family: var(--mono); font-size: .88em; background: var(--bg-tint); border: 1px solid var(--line); border-radius: 5px; padding: 1px 6px; }
.prose pre { background: #0f1115; color: #e8eaf0; border-radius: var(--r-sm); padding: 18px 20px; overflow-x: auto; font-size: 14.5px; }
.prose pre code { background: none; border: none; color: inherit; padding: 0; }
.prose blockquote { margin: 24px 0; padding: 4px 22px; border-left: 3px solid var(--blue); color: var(--ink-2); font-style: italic; }
.prose a { color: var(--blue-press); text-decoration: underline; }
.prose strong { color: var(--ink); }
.post-cta { max-width: 680px; margin: 56px auto 0; text-align: center; background: var(--bg-tint); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 40px 28px; }
```

- [ ] **Step 7: Add Blog links**

`Nav.astro`: inside `.nav-links`, after the Pricing link, add `<a href="/blog/">Blog</a>`.
`Footer.astro`: change the Company column `<div><h5>Company</h5>…</div>` to:

```html
<div><h5>Resources</h5><a href="/blog/">Blog</a><a href="/rss.xml">RSS</a><a href="mailto:prompt-janitor@studiotristar.com">Contact</a></div>
```

and delete the Legal column (`<div><h5>Legal</h5>…</div>`). In `global.css`, change `.footer-cols` to `grid-template-columns: 1.4fr 1fr 1fr;`.

- [ ] **Step 8: Build and verify**

```bash
cd landing && pnpm build
ls dist/blog/index.html dist/rss.xml dist/sitemap-index.xml
grep -c "Field notes on prompt health" dist/blog/index.html   # expect ≥1
```

Expected: build passes with an empty collection; blog index renders the "First posts landing shortly." empty state; RSS and sitemap emitted.

- [ ] **Step 9: Commit**

```bash
git add -A landing
git commit -m "feat(landing): blog infrastructure — content collection, post layout, index, RSS, sitemap"
```

---

### Task 4: Waitlist Cloudflare Worker (`waitlist/`)

Standalone worker, TDD on the pure logic. Two Resend emails per signup, no Audience.

**Files:**
- Create: `waitlist/package.json`, `waitlist/pnpm-workspace.yaml`, `waitlist/tsconfig.json`, `waitlist/wrangler.toml`, `waitlist/README.md`
- Create: `waitlist/src/types.ts`, `waitlist/src/validate.ts`, `waitlist/src/emails.ts`, `waitlist/src/index.ts`
- Test: `waitlist/test/validate.test.ts`, `waitlist/test/emails.test.ts`

**Interfaces:**
- Produces: HTTP `POST /subscribe` accepting JSON `{ email: string, source: string, website?: string }` → `200 {"ok":true}` | `400 {"error":…}` | `502 {"error":"email delivery failed"}`. CORS allows `https://promptjanitor.app` and `http://localhost:4321`. The landing form (Task 5) calls this with `WAITLIST_ENDPOINT` from `consts.ts`.
- Internal: `validateSubscribe(body: unknown): { ok: true; email: string; source: string; bot: boolean } | { ok: false; error: string }`; `buildEmails(email: string, source: string, env: Pick<Env,"OWNER_EMAIL"|"FROM_EMAIL">): EmailPayload[]` (exactly 2 payloads: `[confirmation, ownerNotification]`).

- [ ] **Step 1: Scaffold config files**

`waitlist/package.json`:

```json
{
  "name": "pj-waitlist",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "description": "Waitlist worker: POST /subscribe -> Resend confirmation + owner notification.",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250705.0",
    "typescript": "^5.6.0",
    "vitest": "^3.2.0",
    "wrangler": "^4.26.0"
  }
}
```

`waitlist/pnpm-workspace.yaml` (empty marker so pnpm treats this dir as its own workspace root, same trick as `landing/`):

```yaml
packages: []
```

`waitlist/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src", "test"]
}
```

`waitlist/wrangler.toml`:

```toml
name = "pj-waitlist"
main = "src/index.ts"
compatibility_date = "2026-07-01"

[vars]
ALLOWED_ORIGINS = "https://promptjanitor.app,http://localhost:4321"
OWNER_EMAIL = "prompt-janitor@studiotristar.com"
FROM_EMAIL = "Prompt Janitor <prompt-janitor@studiotristar.com>"

# Secret (set once before deploy): npx wrangler secret put RESEND_API_KEY
```

`waitlist/src/types.ts`:

```ts
export interface Env {
  RESEND_API_KEY: string;
  ALLOWED_ORIGINS: string;
  OWNER_EMAIL: string;
  FROM_EMAIL: string;
}
```

- [ ] **Step 2: Write the failing validation tests — `waitlist/test/validate.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { validateSubscribe } from "../src/validate";

describe("validateSubscribe", () => {
  it("accepts a valid email and known source", () => {
    const r = validateSubscribe({ email: "Dev@Example.com ", source: "hero", website: "" });
    expect(r).toEqual({ ok: true, email: "dev@example.com", source: "hero", bot: false });
  });

  it("accepts blog-<slug> sources", () => {
    const r = validateSubscribe({ email: "a@b.co", source: "blog-diagnosis-should-be-free" });
    expect(r).toMatchObject({ ok: true, source: "blog-diagnosis-should-be-free" });
  });

  it("normalizes unknown sources to 'unknown'", () => {
    const r = validateSubscribe({ email: "a@b.co", source: "evil<script>" });
    expect(r).toMatchObject({ ok: true, source: "unknown" });
  });

  it("rejects malformed emails", () => {
    expect(validateSubscribe({ email: "nope", source: "hero" })).toEqual({ ok: false, error: "invalid email" });
    expect(validateSubscribe({ email: "a@b", source: "hero" })).toEqual({ ok: false, error: "invalid email" });
  });

  it("rejects non-object bodies", () => {
    expect(validateSubscribe(null)).toEqual({ ok: false, error: "invalid body" });
    expect(validateSubscribe("hi")).toEqual({ ok: false, error: "invalid body" });
  });

  it("flags the honeypot as bot", () => {
    const r = validateSubscribe({ email: "a@b.co", source: "hero", website: "http://spam" });
    expect(r).toMatchObject({ ok: true, bot: true });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd waitlist && pnpm install && pnpm test
```

Expected: FAIL — `Cannot find module '../src/validate'`.

- [ ] **Step 4: Implement `waitlist/src/validate.ts`**

```ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const KNOWN_SOURCES = new Set(["hero", "pricing-free", "pricing-pro", "footer"]);

export type ValidationResult =
  | { ok: true; email: string; source: string; bot: boolean }
  | { ok: false; error: string };

export function validateSubscribe(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) return { ok: false, error: "invalid body" };
  const { email, source, website } = body as Record<string, unknown>;
  if (typeof email !== "string") return { ok: false, error: "invalid email" };
  const cleaned = email.trim().toLowerCase();
  if (!EMAIL_RE.test(cleaned) || cleaned.length > 254) return { ok: false, error: "invalid email" };
  const src =
    typeof source === "string" && (KNOWN_SOURCES.has(source) || /^blog-[a-z0-9-]+$/.test(source))
      ? source
      : "unknown";
  const bot = typeof website === "string" && website.length > 0;
  return { ok: true, email: cleaned, source: src, bot };
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test
```

Expected: 6 passing in `validate.test.ts`.

- [ ] **Step 6: Write the failing email-builder tests — `waitlist/test/emails.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { buildEmails } from "../src/emails";

const env = {
  OWNER_EMAIL: "prompt-janitor@studiotristar.com",
  FROM_EMAIL: "Prompt Janitor <prompt-janitor@studiotristar.com>",
};

describe("buildEmails", () => {
  it("builds exactly a confirmation and an owner notification", () => {
    const [confirm, notify] = buildEmails("dev@example.com", "pricing-pro", env);
    expect(confirm.to).toEqual(["dev@example.com"]);
    expect(confirm.from).toBe(env.FROM_EMAIL);
    expect(confirm.subject).toContain("waitlist");
    expect(confirm.text).toContain("$69");
    expect(confirm.text).toContain("https://promptjanitor.app");

    expect(notify.to).toEqual([env.OWNER_EMAIL]);
    expect(notify.subject).toBe("Waitlist signup: dev@example.com (pricing-pro)");
    expect(notify.text).toContain("dev@example.com");
    expect(notify.text).toContain("pricing-pro");
  });
});
```

- [ ] **Step 7: Run to verify failure, then implement `waitlist/src/emails.ts`**

Run: `pnpm test` — expected: FAIL, `Cannot find module '../src/emails'`. Then:

```ts
import type { Env } from "./types";

export interface EmailPayload {
  from: string;
  to: string[];
  subject: string;
  text: string;
}

export function buildEmails(
  email: string,
  source: string,
  env: Pick<Env, "OWNER_EMAIL" | "FROM_EMAIL">,
): EmailPayload[] {
  const confirmation: EmailPayload = {
    from: env.FROM_EMAIL,
    to: [email],
    subject: "You're on the Prompt Janitor waitlist ✅",
    text: [
      "You're in!",
      "",
      "Thanks for joining the Prompt Janitor waitlist. Here's what happens next:",
      "",
      "1. You'll get exactly one email when the app ships — the download link, nothing else.",
      "2. Founder pricing is locked in for you: Pro for $69 instead of $99. One-time, no subscription.",
      "3. Meanwhile, we publish field notes on prompt health: https://promptjanitor.app/blog/",
      "",
      "No drip campaigns, no spam. Reply to this email any time — a human reads it.",
      "",
      "— Prompt Janitor",
      "https://promptjanitor.app",
    ].join("\n"),
  };
  const notification: EmailPayload = {
    from: env.FROM_EMAIL,
    to: [env.OWNER_EMAIL],
    subject: `Waitlist signup: ${email} (${source})`,
    text: `New waitlist signup\n\nEmail: ${email}\nSource: ${source}\nDate: ${new Date().toISOString()}\n`,
  };
  return [confirmation, notification];
}

export async function sendEmails(payloads: EmailPayload[], apiKey: string): Promise<Response> {
  return fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payloads),
  });
}
```

Run: `pnpm test` — expected: all 7 tests pass.

- [ ] **Step 8: Implement the handler — `waitlist/src/index.ts`**

```ts
import { validateSubscribe } from "./validate";
import { buildEmails, sendEmails } from "./emails";
import type { Env } from "./types";

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
  const allow = origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request.headers.get("Origin"), env);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST" || url.pathname !== "/subscribe") {
      return json({ error: "not found" }, 404, cors);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid JSON" }, 400, cors);
    }

    const result = validateSubscribe(body);
    if (!result.ok) return json({ error: result.error }, 400, cors);
    if (result.bot) return json({ ok: true }, 200, cors); // honeypot: pretend success, send nothing

    const res = await sendEmails(buildEmails(result.email, result.source, env), env.RESEND_API_KEY);
    if (!res.ok) {
      console.error("resend error", res.status, await res.text());
      return json({ error: "email delivery failed" }, 502, cors);
    }
    return json({ ok: true }, 200, cors);
  },
};
```

- [ ] **Step 9: Smoke-test with `wrangler dev`**

```bash
cd waitlist
echo 'RESEND_API_KEY=re_dummy_local' > .dev.vars
pnpm dev &   # wait for "Ready on http://localhost:8787"
sleep 5
curl -s -X POST localhost:8787/subscribe -H 'Content-Type: application/json' -d '{"email":"nope","source":"hero"}'
# expect: {"error":"invalid email"} (400)
curl -s -X POST localhost:8787/subscribe -H 'Content-Type: application/json' -d '{"email":"a@b.co","source":"hero","website":"spam"}'
# expect: {"ok":true} (honeypot short-circuit, no Resend call)
curl -s -X POST localhost:8787/subscribe -H 'Content-Type: application/json' -d '{"email":"a@b.co","source":"hero"}'
# expect: {"error":"email delivery failed"} (502 — dummy key rejected by Resend; proves wiring)
kill %1
```

Add `.dev.vars` to `waitlist/.gitignore` (create it):

```
.dev.vars
node_modules/
```

- [ ] **Step 10: Write `waitlist/README.md`**

```markdown
# pj-waitlist

Cloudflare Worker behind the promptjanitor.app waitlist form.
`POST /subscribe` `{ email, source }` → sends 2 emails via Resend:
a confirmation to the subscriber and a notification to
prompt-janitor@studiotristar.com (the owner tracks signups manually — no Resend Audience).

## Develop
pnpm install
echo 'RESEND_API_KEY=re_dummy_local' > .dev.vars
pnpm dev          # wrangler dev on :8787
pnpm test         # vitest

## Deploy (one-time setup)
npx wrangler login
npx wrangler secret put RESEND_API_KEY   # real key; studiotristar.com must be a verified Resend domain
pnpm deploy                              # prints the workers.dev URL
# → paste that URL into landing/src/consts.ts WAITLIST_ENDPOINT (path /subscribe) and redeploy the site.
```

- [ ] **Step 11: Commit**

```bash
git add waitlist
git commit -m "feat(waitlist): Cloudflare Worker — POST /subscribe -> Resend confirmation + owner notification (TDD'd validation/emails)"
```

---

### Task 5: Waitlist form + landing copy rework

Turn the parity port into the pre-launch page: waitlist-first CTAs, new hero, evidence strip, how-it-works, philosophy strip, FAQ updates.

**Files:**
- Rewrite: `landing/src/components/WaitlistForm.astro` (replaces Task 3's stub)
- Create: `landing/src/components/home/EvidenceStrip.astro`, `HowItWorks.astro`, `Philosophy.astro`
- Modify: `landing/src/components/home/Hero.astro`, `Pricing.astro`, `Faq.astro`, `FooterCta.astro`, `Nav.astro`
- Modify: `landing/src/pages/index.astro`
- Modify: `landing/src/styles/global.css` (append CSS below)

**Interfaces:**
- Consumes: `WAITLIST_ENDPOINT`, `CONTACT_EMAIL` from `consts.ts`; worker API from Task 4.
- Produces: `WaitlistForm.astro` props `{ source: string; buttonLabel?: string; compact?: boolean }` — used by Hero (`hero`), Pricing (`pricing-free`/`pricing-pro`), FooterCta (`footer`), BlogPost layout (`blog-<slug>`, already wired in Task 3).

- [ ] **Step 1: Rewrite `landing/src/components/WaitlistForm.astro`**

```astro
---
interface Props {
  source: string;
  buttonLabel?: string;
  compact?: boolean;
}
const { source, buttonLabel = "Join the waitlist", compact = false } = Astro.props;
---
<form class:list={["wl-form", { compact }]} data-source={source} novalidate>
  <input type="email" name="email" required placeholder="you@example.com" aria-label="Email address" autocomplete="email" />
  <input type="text" name="website" class="wl-hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
  <button class="btn" type="submit">{buttonLabel}</button>
  <p class="wl-msg" role="status" aria-live="polite"></p>
</form>

<script>
  import { WAITLIST_ENDPOINT, CONTACT_EMAIL } from "../consts";

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  document.querySelectorAll<HTMLFormElement>(".wl-form").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = form.querySelector<HTMLParagraphElement>(".wl-msg")!;
      const button = form.querySelector<HTMLButtonElement>("button")!;
      const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
      const website = (form.elements.namedItem("website") as HTMLInputElement).value;
      const source = form.dataset.source ?? "unknown";

      msg.className = "wl-msg";
      if (!EMAIL_RE.test(email)) {
        msg.classList.add("err");
        msg.textContent = "That email doesn't look right — mind checking it?";
        return;
      }

      button.disabled = true;
      msg.textContent = "Adding you…";
      try {
        const res = await fetch(WAITLIST_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, source, website }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        window.gtag?.("event", "waitlist_submit", { source });
        msg.classList.add("ok");
        msg.textContent = "You're on the list — confirmation email on its way ✅";
        form.reset();
      } catch {
        msg.classList.add("err");
        msg.innerHTML = `Something went wrong — email us instead: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>`;
      } finally {
        button.disabled = false;
      }
    });
  });
</script>
```

(The `Window.gtag` global is declared in `Base.astro`'s script from Task 1.)

- [ ] **Step 2: Append CSS to `landing/src/styles/global.css`**

```css
/* ---------- waitlist form ---------- */
.wl-form { position: relative; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 30px; }
.wl-form input[type="email"] { font: inherit; font-size: 16px; padding: 12px 18px; min-width: 280px; border-radius: var(--r-pill); border: 1px solid var(--line-2); background: #fff; box-shadow: var(--shadow-sm); }
.wl-form input[type="email"]:focus { border-color: var(--blue); outline: none; }
.wl-hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
.wl-msg { width: 100%; text-align: center; font-size: 14.5px; margin: 10px 0 0; min-height: 1.4em; color: var(--ink-2); }
.wl-msg.ok { color: #1d7a3e; font-weight: 600; }
.wl-msg.err { color: var(--red); }
.wl-msg a { text-decoration: underline; }
.wl-form.compact { justify-content: stretch; margin-top: 0; }
.wl-form.compact input[type="email"] { flex: 1 1 100%; min-width: 0; }
.wl-form.compact .btn { flex: 1 1 100%; justify-content: center; }

/* ---------- evidence strip ---------- */
.ev-stats { display: flex; justify-content: center; gap: 22px; flex-wrap: wrap; margin: 0 0 26px; }
.ev-stat { background: var(--card); border: 1px solid var(--line); border-radius: var(--r-md); box-shadow: var(--shadow-sm); padding: 24px 34px; min-width: 220px; }
.ev-stat .n { font-family: var(--display); font-weight: 700; font-size: 40px; letter-spacing: -.03em; }
.ev-stat .l { color: var(--ink-2); font-size: 15px; margin-top: 4px; }
.ev-caveat { max-width: 580px; margin: 0 auto; font-size: 14.5px; color: var(--ink-3); text-align: center; }
.ev-link { display: inline-block; margin-top: 18px; color: var(--blue-press); font-weight: 600; }
.evidence { text-align: center; }

/* ---------- how it works ---------- */
.how { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.how-step { background: var(--card); border: 1px solid var(--line); border-radius: var(--r-md); box-shadow: var(--shadow-sm); padding: 26px 24px; }
.how-step .n { display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 10px; background: var(--blue-tint); color: var(--blue-press); font-family: var(--display); font-weight: 700; margin-bottom: 14px; }
.how-step h4 { font-size: 19px; }
.how-step p { color: var(--ink-2); font-size: 15.5px; margin: 8px 0 0; }
@media (max-width: 720px) { .how { grid-template-columns: 1fr; } }

/* ---------- philosophy strip ---------- */
.philosophy { text-align: center; }
.philosophy blockquote { font-family: var(--display); font-weight: 600; letter-spacing: -.02em; font-size: clamp(24px, 3.4vw, 36px); line-height: 1.25; color: var(--ink); max-width: 22ch; margin: 18px auto 0; }
.philosophy .who { margin: 22px auto 0; color: var(--ink-2); font-size: 17px; max-width: 560px; }
```

- [ ] **Step 3: Rework `home/Hero.astro`**

Replace the component body with (hero-shot block and trust-check SVG markup carried over verbatim from the current file):

```astro
---
import WaitlistForm from "../WaitlistForm.astro";
---
<header class="hero" id="hero">
  <div class="wrap">
    <div class="eyebrow">macOS app · runs 100% locally · launching soon</div>
    <h1 style="margin-top:16px;">Know in 10 seconds<br>if your prompts are good enough.</h1>
    <p class="lead">Prompt Janitor scans every <span style="font-family:var(--mono);font-size:.92em;">AGENTS.md</span> and <span style="font-family:var(--mono);font-size:.92em;">CLAUDE.md</span> on your Mac, grades them A–F against the industry's own standards, and flags what's rotting — before your agents trip on it.</p>
    <WaitlistForm source="hero" />
    <div class="trust">
      <!-- keep the four existing <span>✓ …</span> entries, but replace the last one
           ("30-day grade-up guarantee") with: -->
      <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="5 12.5 10 17.5 19 7"/></svg> Founder pricing locked: $69</span>
    </div>
    <!-- .hero-shot block unchanged -->
  </div>
</header>
```

- [ ] **Step 4: Create `home/EvidenceStrip.astro`**

```astro
<section class="section tint evidence" id="evidence">
  <div class="wrap">
    <div class="section-head">
      <div class="eyebrow">Evidence, not vibes</div>
      <h2 style="margin-top:12px;">We measure what bad prompts actually cost.</h2>
      <p>We run controlled benchmarks: the same coding task, the same agent, one prompt defect apart. Then we count the damage.</p>
    </div>
    <div class="ev-stats">
      <div class="ev-stat"><div class="n">+36k</div><div class="l">tokens burned per task<br>with one defective prompt</div></div>
      <div class="ev-stat"><div class="n">+0.8</div><div class="l">extra agent turns<br>to finish the same task</div></div>
      <div class="ev-stat"><div class="n">−0.4</div><div class="l">major review issues<br>after the prompt was fixed</div></div>
    </div>
    <p class="ev-caveat">Early numbers from our first controlled runs (N=5) — not yet statistically significant, and we say so. The full powered benchmark runs next, and we're publishing everything, methodology included.</p>
    <a class="ev-link" href="/blog/what-a-bad-prompt-actually-costs/">Read the methodology →</a>
  </div>
</section>
```

- [ ] **Step 5: Create `home/HowItWorks.astro`**

```astro
<section class="section" id="how">
  <div class="wrap">
    <div class="section-head">
      <h2>Scan. Grade. Treat.</h2>
      <p>Diagnosis is free forever. Treatment is what you pay for.</p>
    </div>
    <div class="how">
      <div class="how-step"><span class="n" aria-hidden="true">1</span><h4>Scan</h4><p>Point it at your projects. It finds every prompt file — <code>CLAUDE.md</code>, <code>AGENTS.md</code>, <code>.cursorrules</code> — and rescans on a schedule.</p></div>
      <div class="how-step"><span class="n" aria-hidden="true">2</span><h4>Grade</h4><p>Each file gets an A–F health grade against source-cited standards from Anthropic, OpenAI, and the practitioners who wrote the playbook.</p></div>
      <div class="how-step"><span class="n" aria-hidden="true">3</span><h4>Treat</h4><p>Pro rewrites the weak parts with AI — apply with a backup, one-click undo, and an optional git branch so changes stay reviewable.</p></div>
    </div>
  </div>
</section>
```

- [ ] **Step 6: Create `home/Philosophy.astro`**

```astro
<section class="section tint philosophy">
  <div class="wrap">
    <div class="eyebrow">Why we're building this</div>
    <blockquote>“Prompt files are infrastructure.<br>Nobody inspects them.”</blockquote>
    <p class="who">Your agents read these files on every single run — yet there's no linter, no review, no grade. We think diagnosis should be free, for everyone, forever. Treatment is what you pay for.</p>
    <a class="ev-link" href="/blog/diagnosis-should-be-free/">Read the manifesto →</a>
  </div>
</section>
```

- [ ] **Step 7: Rework `home/Pricing.astro` CTAs**

Import the form: add `import WaitlistForm from "../WaitlistForm.astro";` to frontmatter.

Free card — replace the `<a class="btn ghost" href="#">… Download for macOS</a>` and the `price-note` under it with:

```astro
<WaitlistForm source="pricing-free" compact buttonLabel="Join the waitlist" />
<p class="price-note">Launching soon — the waitlist gets the download first. No payment, no account.</p>
```

Pro card — replace `<a class="btn" data-polar-checkout …>Get Pro — $69</a>` (or the plain anchor from Task 2) and the two `price-note` paragraphs with:

```astro
<WaitlistForm source="pricing-pro" compact buttonLabel="Join — lock in $69" />
<p class="price-note">Founder pricing is locked for waitlist members at launch.<br>One-time purchase: perpetual license + 12 months of updates · $29/yr optional renewal, never required.</p>
```

Keep the guarantee block unchanged.

- [ ] **Step 8: Update `home/Faq.astro`**

Insert two new accordion items at the TOP of `#faqList` (same `.acc` markup pattern as the existing items):

1. Q: `When does it launch?` — A: `Soon — Prompt Janitor is in pre-launch. Join the waitlist and you'll get the download link the moment it ships, with founder pricing ($69 instead of $99) locked in.`
2. Q: `What happens when I join the waitlist?` — A: `You get one confirmation email right away, and one email when the app launches. That's the whole campaign — no drip sequences, and you can unsubscribe any time.`

Change the LAST item's answer (`How do I get the app?`) to: `It's pre-launch. Join the waitlist and you'll be scanning within a minute of the launch email — no account, no sign-up.`

- [ ] **Step 9: Rework `home/FooterCta.astro` and `Nav.astro`**

`FooterCta.astro`: add `import WaitlistForm from "../WaitlistForm.astro";`; replace the `<a class="btn" …>Download for macOS</a>` with `<WaitlistForm source="footer" />`; change the `<p>` to `Give your prompts the visibility layer they've been missing — waitlist members launch first, at founder pricing.`

`Nav.astro`: replace the Download button with `<a class="btn sm" href="/#hero">Join waitlist</a>` (drop the download-arrow SVG).

- [ ] **Step 10: Update `index.astro` section order**

```astro
<Hero />
<EvidenceStrip />
<TagStrip />
<FeatureRows />
<HowItWorks />
<MiniCards />
<Audience />
<Philosophy />
<Pricing />
<Faq />
<FooterCta />
```

(Add the three new imports. Section backgrounds alternate acceptably: EvidenceStrip and Philosophy carry `tint`; TagStrip/HowItWorks/MiniCards/Pricing/FooterCta are white; FeatureRows/Audience/Faq keep their existing `tint`.)

- [ ] **Step 11: Build and verify**

```bash
cd landing && pnpm build && pnpm preview --port 4321 &
sleep 2
H=$(curl -s http://localhost:4321/)
echo "$H" | grep -c "Know in 10 seconds"                 # expect 1
echo "$H" | grep -c "wl-form"                            # expect ≥4 (hero, 2 pricing, footer)
echo "$H" | grep -c "not yet statistically significant"  # expect 1
echo "$H" | grep -c "data-polar-checkout"                # expect 0
echo "$H" | grep -c "When does it launch?"               # expect 1
kill %1
```

Browser check: hero form submits → with the worker NOT deployed the fetch fails → the mailto fallback message appears (this is the designed failure mode). If `waitlist` `wrangler dev` is running on :8787, temporarily point `WAITLIST_ENDPOINT` to `http://localhost:8787/subscribe`, run `pnpm dev`, and verify the 400/honeypot/502 paths end-to-end — then restore the production value.

- [ ] **Step 12: Commit**

```bash
git add -A landing
git commit -m "feat(landing): waitlist-first rework — hero, evidence strip, how-it-works, philosophy, pricing/FAQ/nav CTAs"
```

---

### Task 6: Blog post — "The 7 defects that quietly poison your agent's context"

**Files:**
- Create: `landing/src/content/blog/seven-defects-that-poison-your-agents-context.md`

**Interfaces:**
- Consumes: blog collection schema from Task 3. Cross-check each defect against `docs/standards/prompting-standards.md` (the 25-standard catalog) and keep the citations accurate; adjust attribution wording if the catalog attributes a standard differently.

- [ ] **Step 1: Write the post** — full draft (owner edits voice before launch):

```markdown
---
title: "The 7 defects that quietly poison your agent's context"
description: "Your CLAUDE.md is read on every single agent run. These are the seven most common ways it silently makes your agent slower, dumber, and more expensive."
pubDate: 2026-07-16
tags: ["prompt-files", "craft"]
---

Every time your coding agent starts a task, it reads your instruction files first — `CLAUDE.md`, `AGENTS.md`, `.cursorrules`. That text is load-bearing: it shapes every decision the agent makes, on every run, in every repo where it exists.

And almost nobody reviews it. It gets appended to in a hurry, copied between projects, and left to rot. Here are the seven defects we see most often — each one maps to a standard in our 25-standard catalog, with the source it's distilled from.

## 1. Contradictory instructions

"Always write tests first." Forty lines later: "Don't add tests unless asked." Both landed in the file months apart, and now the agent has to guess which one you mean — so it guesses differently on different runs. Contradictions are the worst defect class because they don't degrade output consistently; they make it *random*. Anthropic's guidance is blunt about this: models follow instructions literally, and conflicting rules produce unstable behavior.

**Check:** read your file end-to-end and ask, for each rule, "does anything else in here disagree?"

## 2. Stale or hard-coded model names

"Use gpt-4-32k for summarization." That model doesn't exist anymore, but your prompt still insists on it. Hard-coded model names, versions, and API shapes rot faster than any other content in a prompt file. When the reference goes stale, the agent either errors, silently substitutes, or — worse — treats the whole file as less trustworthy context.

**Check:** grep your prompt files for model identifiers and dates. If it can go out of date, it needs an owner or it needs to go.

## 3. Missing examples

You describe the output you want in prose, and the agent gives you something adjacent to it. One good example beats three paragraphs of description — few-shot examples are the single most reliable way to pin down format and tone, and both Anthropic and OpenAI put examples near the top of their prompting guidance. This is also the defect we chose for our first controlled benchmark run, precisely because it's so common. [Early numbers here](/blog/what-a-bad-prompt-actually-costs/).

**Check:** for every "the output should…" sentence, ask whether an example would say it better. It usually does.

## 4. Walls of text

A 400-line CLAUDE.md with no headings is not documentation, it's sediment. Models handle structure well and unstructured sprawl badly; important rules buried in paragraph twelve compete with trivia for the agent's attention. Karpathy's framing is useful here: context is a scarce resource — spend it like money.

**Check:** if you can't find a rule in five seconds by scanning headings, neither can your agent.

## 5. No role or persona

Files that jump straight into micro-rules ("use 2-space indent") without ever saying what the agent *is* — senior engineer on this codebase? careful reviewer? — lose a cheap, powerful lever. A one-line role sets defaults for hundreds of small decisions you didn't think to specify.

**Check:** does the first paragraph tell the agent who it is and what good work looks like here?

## 6. Unspecified output format

"Summarize the changes" — as prose? bullets? a commit message? a table? When the format is unspecified, the agent picks one, and you pay a review round-trip to fix it. OpenAI's guidance treats explicit output contracts as table stakes for reliable automation.

**Check:** every task your file describes should say what the deliverable looks like.

## 7. Instructions that drifted from reality

The file says "run `make test`" but the project moved to `pnpm test` a year ago. It references directories that were renamed, services that were decommissioned, conventions the team abandoned. Repo drift is invisible until an agent takes the instruction literally — and it will.

**Check:** do the commands and paths in your prompt file still exist? (This is exactly the class of thing a deterministic scanner is better at than you are.)

---

## The uncomfortable part

None of these defects announce themselves. Your agent doesn't error — it just quietly burns more tokens, takes more turns, and produces work that needs more review. That's why we built [Prompt Janitor](/): it scans every prompt file on your Mac, grades each one A–F against these standards (source-cited, deterministic, free), and — if you want — rewrites the weak parts.
```

- [ ] **Step 2: Build and verify**

```bash
cd landing && pnpm build
ls dist/blog/seven-defects-that-poison-your-agents-context/index.html
grep -c "seven-defects" dist/rss.xml   # expect ≥1
```

- [ ] **Step 3: Commit**

```bash
git add landing/src/content/blog/seven-defects-that-poison-your-agents-context.md
git commit -m "content(blog): the 7 defects that poison agent context"
```

---

### Task 7: Blog post — "We measured what a bad prompt actually costs"

**Files:**
- Create: `landing/src/content/blog/what-a-bad-prompt-actually-costs.md`

**Interfaces:**
- Consumes: numbers from `benchmark/effects.json` and `docs/BENCHMARK_STATUS.md` — the figures below are copied from them; do not embellish. The honesty rule from Global Constraints applies with full force here.

- [ ] **Step 1: Write the post:**

```markdown
---
title: "We measured what a bad prompt actually costs"
description: "Everyone says bad prompts waste money. We built a controlled benchmark to find out how much — same task, same agent, one defect apart. Here are the first honest numbers."
pubDate: 2026-07-16
tags: ["benchmark", "evidence"]
---

"Bad prompts cost you money" is the kind of claim everyone nods at and nobody measures. We're building a prompt-health tool, so we don't get to hand-wave — if we say a defect matters, we should be able to show what it costs. So we built a benchmark harness and started measuring.

This post explains the methodology and shares our first numbers — including the caveats most marketing pages would leave out.

## The setup

The core idea is a **controlled pair**: two versions of the same project fixture that are identical in every way — same code, same task, same agent — except the prompt file differs by exactly **one defect**. One version's `CLAUDE.md` has the defect; the other has the fix. Any difference in outcome is attributable to that one change.

For each side of the pair, the harness:

1. Spawns a fresh headless coding agent (Claude Code) on a copy of the fixture and gives it the same task.
2. Records **tokens** (including cache reads — they're billed too), **agent turns**, and whether a **deterministic verifier** (a script, not a model) accepts the result.
3. Sends the produced diff to a separate reviewer model that counts **review burden**: how many major/minor issues a reviewer would flag.

We repeat that N times per side, then compute the delta with a bootstrap 95% confidence interval. An effect only counts as *significant* if the interval excludes zero. No cherry-picking: the harness writes every run to a versioned `effects.json`, and the significance flag is computed, not asserted.

## First numbers (read the caveat)

Our first validated run targeted one defect — a prompt file **missing few-shot examples** — with N=5 runs per side on a small model:

- **Tokens:** the defective prompt cost **+36.8k tokens per task** on average (95% CI: −24.7k to +98.5k)
- **Turns:** **+0.8 extra agent turns** on average (95% CI: −1.4 to +3.0)
- **Review burden:** the fixed prompt drew **0.4 fewer major review issues** per run

**The caveat, in bold, above the fold: none of this is statistically significant yet.** Both confidence intervals span zero. N=5 is a smoke test — it validates that the harness works end-to-end, not that the effect is proven. The direction is encouraging and consistent across metrics, but if we stopped here and put "+36k tokens!" on a billboard, we'd be doing the thing we built this benchmark to avoid.

## What would make it significant

Statistical power. The variance between agent runs is large (that's the honest reason most people don't benchmark prompts — single anecdotes are noise). Next steps, in order:

1. **More iterations per pair** until the confidence intervals tighten enough to exclude zero — or to show the effect isn't real. We'll publish either result.
2. **Four more defect fixtures**, one per headline rule (contradictory instructions, stale model names, missing structure, unspecified output format), so the benchmark covers the defects we flag most.
3. **A stronger agent model** for the powered run, closer to what people actually use day-to-day.

Everything ships versioned: model, agent version, temperature, and suite version are stamped into the results file, so a number is never quoted without its provenance.

## Why a prompt-linting company publishes its own null results

Because the alternative is worse. Prompt advice today is almost entirely vibes — screenshots, threads, "this one trick". If we want "your prompt file has a defect" to mean something, the claim has to be falsifiable, and we have to accept the risk that some defects turn out not to matter. Those rules should get demoted. That's the deal.

[Prompt Janitor](/) grades your prompt files against these standards today — deterministically, source-cited, free, on your machine. The benchmark is how we earn the right to say the grades matter.
```

- [ ] **Step 2: Build and verify**

```bash
cd landing && pnpm build
ls dist/blog/what-a-bad-prompt-actually-costs/index.html
grep -c "none of this is statistically significant" dist/blog/what-a-bad-prompt-actually-costs/index.html  # expect 1
```

(The evidence-strip link on the landing page now resolves — click through in preview.)

- [ ] **Step 3: Commit**

```bash
git add landing/src/content/blog/what-a-bad-prompt-actually-costs.md
git commit -m "content(blog): benchmark methodology + honest first numbers"
```

---

### Task 8: Blog post — "Diagnosis should be free"

**Files:**
- Create: `landing/src/content/blog/diagnosis-should-be-free.md`

- [ ] **Step 1: Write the post:**

```markdown
---
title: "Diagnosis should be free"
description: "Prompt files are infrastructure nobody inspects. Our manifesto: knowing how healthy your prompts are should cost nothing — fixing them is what you pay for."
pubDate: 2026-07-16
tags: ["philosophy"]
---

There's a category of file on your machine that gets read more often than any documentation you've ever written, shapes more decisions than your linter config, and receives less review than a typo fix: your prompt files. `CLAUDE.md`. `AGENTS.md`. `.cursorrules`.

Every agent run starts by reading them. They are, functionally, infrastructure — and they're managed like sticky notes.

## The strange gap

For every other kind of load-bearing text in a codebase, we built inspection layers years ago. Code gets linters, type checkers, CI, review. Dependencies get audit tools and version pins. Even commit messages get hooks.

Prompt files get nothing. No grade, no diff review culture, no drift detection. They accumulate by appendix — someone hits a problem, adds a rule, moves on. Six months later the file contradicts itself, references commands that no longer exist, and quietly taxes every single agent run. Nobody notices, because the failure mode isn't a crash — it's an agent that's a little slower, a little dumber, and a little more expensive, forever.

We built Prompt Janitor because we kept paying that tax ourselves.

## Why diagnosis is free — actually free

Prompt Janitor's scanner runs on your Mac, grades every prompt file A–F against source-cited standards, rescans on a schedule, tracks history, and alerts you when a grade slips. All of that is free. Not trial-free, not "5 scans a month" free, not "findings blurred until you pay" free. Free, with no scan caps, forever. Even the 25-standard AI-powered catalog evaluation is free when you bring your own compute — a local Ollama model or your own API key.

This isn't generosity; it's a position:

**You can't charge someone to find out whether they have a problem.** A diagnostic tool that hides its findings behind a paywall has an incentive to make everything look sick. The only way grades stay honest is if the grade costs nothing and we make money elsewhere.

**Visibility should be universal, because the problem is universal.** Every person with a prompt file benefits from knowing its health — including the majority who will never pay us. That's fine. That's how infrastructure tooling should work.

**The benchmark keeps us honest.** We're [measuring what prompt defects actually cost](/blog/what-a-bad-prompt-actually-costs/) with controlled experiments, and publishing methodology, confidence intervals, and null results alike. If a rule doesn't demonstrably matter, it gets demoted — free users get the same standards updates as paying ones.

## What you pay for: treatment

Diagnosis tells you the file is a D. Treatment is the work of making it an A — and that's Pro: AI rewrites of the weak parts, one-click apply with backup and undo, your own standards enforced in plain English, starter templates per stack. A one-time $69 purchase (founder pricing), perpetual license, no subscription. If your prompt health doesn't rise a full letter grade in 30 days, full refund.

Free tells you the truth. Pro fixes it. We think that's the only honest way to build this category.

---

Prompt Janitor is launching soon on macOS. The scanner — the whole diagnosis layer — will be free from day one.
```

- [ ] **Step 2: Build and verify**

```bash
cd landing && pnpm build
ls dist/blog/diagnosis-should-be-free/index.html
grep -c 'href="/blog/' dist/index.html   # expect ≥2 (evidence + philosophy links resolve)
```

- [ ] **Step 3: Commit**

```bash
git add landing/src/content/blog/diagnosis-should-be-free.md
git commit -m "content(blog): diagnosis-should-be-free manifesto"
```

---

### Task 9: Docs, UTM convention, and final end-to-end verification

**Files:**
- Modify: `landing/README.md`
- Create: `docs/marketing/utm-convention.md`

- [ ] **Step 1: Rewrite `landing/README.md`**

```markdown
# Prompt Janitor — marketing site

Astro 5 static site (pre-launch: waitlist-first). Deployed to GitHub Pages on
pushes to `main` (`.github/workflows/landing.yml`), custom domain
`promptjanitor.app` (public/CNAME — DNS must point at GitHub Pages).

Deliberately outside the app's pnpm workspace (own pnpm-workspace.yaml).

## Develop
pnpm install
pnpm dev            # localhost:4321
pnpm build          # runs the field-guide generator, then astro build -> dist/

## Structure
- src/pages/         index, thanks, blog/, rss.xml
- src/components/    Nav, Footer, WaitlistForm + home/* sections (one section per file)
- src/content/blog/  markdown posts (title/description/pubDate/tags/draft)
- src/consts.ts      GA_ID, WAITLIST_ENDPOINT (update after deploying waitlist/), site URL
- scripts/build-field-guide.mjs  generates public/field-guide.html from docs/standards

## Waitlist
Forms POST to the `waitlist/` Cloudflare Worker (see waitlist/README.md for
deploy steps). Until the worker is deployed and WAITLIST_ENDPOINT updated,
forms show a mailto fallback on submit.

## Analytics
GA4 (G-RX37WJZFSQ), production builds only. Events: waitlist_submit{source},
cta_click{href}. Social posts use the UTM convention in docs/marketing/utm-convention.md.
```

- [ ] **Step 2: Create `docs/marketing/utm-convention.md`**

```markdown
# UTM convention — prelaunch traction test

Every social link uses: `utm_medium=social`, `utm_campaign=prelaunch`, and a
per-channel `utm_source`, so GA4 (G-RX37WJZFSQ) can attribute waitlist signups
per channel (Reports → Acquisition → Traffic acquisition; conversions =
`waitlist_submit`).

| Channel | Link to post |
|---|---|
| X / Twitter | https://promptjanitor.app/?utm_source=x&utm_medium=social&utm_campaign=prelaunch |
| LinkedIn | https://promptjanitor.app/?utm_source=linkedin&utm_medium=social&utm_campaign=prelaunch |
| Reddit | https://promptjanitor.app/?utm_source=reddit&utm_medium=social&utm_campaign=prelaunch |
| Hacker News | https://promptjanitor.app/?utm_source=hn&utm_medium=social&utm_campaign=prelaunch |

For blog-post shares, keep the same params on the post URL, e.g.
https://promptjanitor.app/blog/what-a-bad-prompt-actually-costs/?utm_source=hn&utm_medium=social&utm_campaign=prelaunch

Waitlist `source` values (hero / pricing-free / pricing-pro / footer / blog-<slug>)
arrive in the owner-notification email subject and in GA4's waitlist_submit
event — UTM says where they came FROM, source says which CTA converted.
```

- [ ] **Step 3: Full verification pass**

```bash
# Site
cd landing && pnpm build && pnpm preview --port 4321 &
sleep 2
for p in / /blog/ /blog/seven-defects-that-poison-your-agents-context/ /blog/what-a-bad-prompt-actually-costs/ /blog/diagnosis-should-be-free/ /thanks/ /rss.xml /sitemap-index.xml /field-guide.html; do
  printf "%s -> %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:4321$p)"
done   # expect 200 for all
curl -s http://localhost:4321/ | grep -c "G-RX37WJZFSQ"   # expect ≥1
kill %1

# Worker
cd ../waitlist && pnpm test   # expect 7 passing
```

Then a manual pass in the browser (desktop + narrow viewport): hero form validation message, FAQ accordion, blog nav round-trip, no horizontal scroll on mobile width.

- [ ] **Step 4: Commit**

```bash
git add landing/README.md docs/marketing/utm-convention.md
git commit -m "docs: marketing site README + UTM convention for the traction test"
```

- [ ] **Step 5: Open the PR**

```bash
git push -u origin feat/prelaunch-site
gh pr create --base main --title "feat(site): pre-launch marketing site — Astro, waitlist, GA4, blog" --body "$(cat <<'EOF'
Implements docs/superpowers/specs/2026-07-16-prelaunch-marketing-site-design.md.

- Astro 5 migration of landing/ (visual identity preserved), promptjanitor.app + CNAME
- Waitlist-first CTAs everywhere; pricing visible ($69 founder, lock-in framing)
- New sections: evidence strip (honest N=5 framing), how-it-works, philosophy
- Blog: 3 launch posts + RSS + sitemap; GA4 G-RX37WJZFSQ with waitlist_submit/cta_click
- waitlist/ Cloudflare Worker: POST /subscribe -> Resend confirmation + owner notification (no Audience)
- Supersedes the landing parts of PR #89 (branch merged in)

Go-live checklist (owner):
- [ ] Verify studiotristar.com as a Resend sending domain; wrangler secret put RESEND_API_KEY; pnpm deploy in waitlist/
- [ ] Paste the printed workers.dev URL into landing/src/consts.ts WAITLIST_ENDPOINT
- [ ] Point promptjanitor.app DNS at GitHub Pages; set custom domain in repo Settings -> Pages
- [ ] One real end-to-end signup test (confirmation + notification email received)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Post-launch follow-ups (explicitly NOT in this plan)

- Deploying the worker and DNS (owner actions, listed in the PR checklist).
- Closing PR #89 as superseded once this merges.
- Polar checkout wiring, macOS download link, app/fulfillment changes, benchmark powered run (gated on traction — see `docs/BENCHMARK_STATUS.md`).

## Self-Review

- Spec coverage: waitlist-first CTAs w/ visible pricing (T5), GA4-only analytics + UTM (T1/T9), landing+blog scope (T2/T3), Astro stack (T1), no-Audience Resend flow w/ owner notification (T4), the 3 approved posts (T6–8), evidence honesty rule (T5/T7), promptjanitor.app + CNAME (T1), thanks kept (T2), field guide kept via generator (T2), out-of-scope list respected. ✓
- Types: `WaitlistForm` props consistent across T3 stub / T5 final / T7 pricing usage; worker `source` regex accepts every `blog-<slug>` the layout emits (slugs are lowercase-kebab ✓); `validateSubscribe`/`buildEmails` signatures match between tests and impls. ✓
- Known deliberate gap: `WAITLIST_ENDPOINT` contains a `YOUR-SUBDOMAIN` placeholder — unavoidable until the owner's first `wrangler deploy`; the form's mailto fallback covers the interim, and the PR checklist tracks it. ✓
```