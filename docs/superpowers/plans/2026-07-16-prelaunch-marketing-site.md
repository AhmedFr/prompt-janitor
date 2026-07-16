# Pre-launch Marketing Site Implementation Plan (Next.js / Vercel)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `landing/` to Next.js with a waitlist-first landing page, a 3-post blog, GA4 analytics, and a same-origin `/api/subscribe` route that emails waitlist signups via Resend — so the owner can post on socials and measure traction before committing more dev.

**Architecture:** Next.js 15 App Router (TypeScript, `src/` layout) in the same `landing/` directory, deployed on Vercel (project root dir = `landing/`). The existing `styles.css` design moves verbatim to `globals.css`; markup is ported to React components following the repo convention (folder per component: `index.ts` + `Component.tsx` + `.types.ts` when it has props). The waitlist is a Next API route holding the Resend key server-side — no separate backend. Blog posts are markdown files parsed with gray-matter + remark, statically generated.

**Tech Stack:** Next.js ^15, React ^19, @next/third-parties (GA4), gray-matter, remark + remark-html, vitest, pnpm, Vercel, Resend REST API.

**Spec:** `docs/superpowers/specs/2026-07-16-prelaunch-marketing-site-design.md`

## Global Constraints

- Package manager: **pnpm**. `landing/` stays its own pnpm workspace root (keep its `pnpm-workspace.yaml`), isolated from the app workspace.
- **GA4 measurement ID:** `G-RX37WJZFSQ` (exact).
- **Domain:** `https://promptjanitor.app` (exact — `metadataBase`, RSS, sitemap).
- **Sender/notification email:** `prompt-janitor@studiotristar.com` (exact). No Resend Audience — two plain emails per signup.
- **Pricing copy:** Pro is **$69** (struck `$99`), "Founder pricing · one-time", `$29/yr` optional renewal. Never change these numbers.
- **Benchmark honesty rule:** every mention of benchmark numbers MUST carry the N=5 / not-yet-significant caveat. Never write "proven".
- **No changes** to `src/` (app), `src-tauri/`, `fulfillment/`, or `benchmark/`.
- Component convention (repo-wide rule): each React component with props lives in its own folder with `index.ts` (re-export), `ComponentName.tsx`, and `ComponentName.types.ts`; prop-less section components may omit the types file. One clear responsibility per file.
- The base branch is `feat/prelaunch-site` (already contains the merged PR #89 landing at commit `8af1c11`). All line-range references to `landing/index.html`, `landing/thanks.html` refer to that state.
- Blog slugs (exact, used in links before the posts exist): `seven-defects-that-poison-your-agents-context`, `what-a-bad-prompt-actually-costs`, `diagnosis-should-be-free`.
- Waitlist `source` values (exact): `hero`, `pricing-free`, `pricing-pro`, `footer`, `blog-<slug>`.
- **RESEND_API_KEY** is server-only: env var on Vercel, `.env.local` in dev, never referenced in a `"use client"` file.

## HTML→JSX porting rules (apply everywhere markup is moved)

- `class` → `className`; kebab-case SVG attrs → camelCase (`stroke-width` → `strokeWidth`, `stroke-linecap` → `strokeLinecap`, `stroke-linejoin` → `strokeLinejoin`, `stroke-opacity` → `strokeOpacity`); `tabindex` → `tabIndex`; `autocomplete` → `autoComplete`.
- Inline `style="a:b;c:d"` → `style={{ a: "b", c: "d" }}` with camelCase properties.
- HTML entities in text can stay (`&amp;` → `&` is fine in JSX text; keep `&nbsp;` as `{" "}` or plain space).
- Comments `<!-- -->` → `{/* */}`.

---

### Task 1: Next.js scaffold in `landing/`

Replace the Vite toolchain with Next.js; keep the design system CSS. Ends with a building placeholder site.

**Files:**
- Create: `landing/next.config.ts`, `landing/tsconfig.json`, `landing/next-env.d.ts` (generated), `landing/.gitignore`, `landing/.env.local` (untracked)
- Create: `landing/src/app/layout.tsx`, `landing/src/app/page.tsx` (placeholder, replaced in Task 2)
- Create: `landing/src/app/globals.css` (moved from `landing/src/styles.css`)
- Create: `landing/src/lib/constants.ts`
- Create: `landing/src/components/AnalyticsClicks/{index.ts,AnalyticsClicks.tsx}`
- Modify: `landing/package.json` (full rewrite below)
- Delete: `landing/vite.config.js`, `landing/src/main.js` (its 3 jobs die or move: Polar wiring is removed per spec; FAQ accordion becomes React state in Task 2; footer year is computed in `Footer.tsx`)

**Interfaces:**
- Produces: root layout owning `<head>` metadata + GA4 + skip-link; `constants.ts` exports `SITE_URL`, `SITE_TITLE`, `GA_ID`, `CONTACT_EMAIL`, `OWNER_EMAIL`, `FROM_EMAIL`. Every later page/component imports from `@/lib/constants`. Path alias `@/*` → `./src/*`.

- [ ] **Step 1: Rewrite `landing/package.json`**

```json
{
  "name": "prompt-janitor-landing",
  "private": true,
  "version": "0.2.0",
  "description": "Marketing site for Prompt Janitor (Next.js on Vercel).",
  "scripts": {
    "dev": "next dev",
    "build": "node scripts/build-field-guide.mjs && next build",
    "start": "next start",
    "test": "vitest run",
    "build:guide": "node scripts/build-field-guide.mjs"
  },
  "dependencies": {
    "@next/third-parties": "^15.4.0",
    "gray-matter": "^4.0.3",
    "next": "^15.4.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "remark": "^15.0.1",
    "remark-html": "^16.0.1"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "typescript": "^5.6.0",
    "vitest": "^3.2.0"
  }
}
```

Note `build` chains the field-guide generator first — Vercel and CI both just run `pnpm build`. Keep `landing/pnpm-workspace.yaml` as is. `"type": "module"` is intentionally dropped (Next manages module handling; the generator script keeps working because it's `.mjs`).

- [ ] **Step 2: Create `landing/next.config.ts` and `landing/tsconfig.json`**

`next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `landing/.gitignore` and `.env.local`**

`landing/.gitignore`:

```
node_modules/
.next/
out/
.env*.local
.vercel
public/field-guide.html
```

`landing/.env.local` (untracked, dev only):

```
RESEND_API_KEY=re_dummy_local
```

- [ ] **Step 4: Move the stylesheet**

```bash
mkdir -p landing/src/app landing/src/lib landing/src/components
git mv landing/src/styles.css landing/src/app/globals.css
git rm landing/vite.config.js landing/src/main.js
```

- [ ] **Step 5: Create `landing/src/lib/constants.ts`**

```ts
export const SITE_TITLE = "Prompt Janitor";
export const SITE_URL = "https://promptjanitor.app";
export const GA_ID = "G-RX37WJZFSQ";
export const CONTACT_EMAIL = "prompt-janitor@studiotristar.com";
// Server-side email identities (used only by the API route)
export const OWNER_EMAIL = "prompt-janitor@studiotristar.com";
export const FROM_EMAIL = "Prompt Janitor <prompt-janitor@studiotristar.com>";
```

- [ ] **Step 6: Create `landing/src/components/AnalyticsClicks/`**

`AnalyticsClicks.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { sendGAEvent } from "@next/third-parties/google";

export function AnalyticsClicks() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element).closest?.("a.btn, a.ev-link");
      if (a) sendGAEvent("event", "cta_click", { href: a.getAttribute("href") ?? "" });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
```

`index.ts`:

```ts
export { AnalyticsClicks } from "./AnalyticsClicks";
```

- [ ] **Step 7: Create `landing/src/app/layout.tsx`**

```tsx
import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import { AnalyticsClicks } from "@/components/AnalyticsClicks";
import { GA_ID, SITE_URL } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Prompt Janitor — Grade every prompt on your Mac",
  description:
    "Prompt Janitor scans every AGENTS.md and CLAUDE.md on your Mac and grades them A–F against the industry's own standards — free, forever, on your machine. Fixing them is Pro: a one-time purchase, no subscription.",
  icons: { icon: "/favicon.svg" },
  alternates: {
    canonical: "./",
    types: { "application/rss+xml": "/rss.xml" },
  },
  openGraph: { type: "website", siteName: "Prompt Janitor" },
};

export const viewport: Viewport = { themeColor: "#0a84ff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
        <AnalyticsClicks />
      </body>
      {process.env.NODE_ENV === "production" && <GoogleAnalytics gaId={GA_ID} />}
    </html>
  );
}
```

- [ ] **Step 8: Create placeholder `landing/src/app/page.tsx`**

```tsx
export default function Home() {
  return (
    <main id="main">
      <h1>Prompt Janitor</h1>
    </main>
  );
}
```

- [ ] **Step 9: Install and build**

```bash
cd landing && pnpm install && pnpm build
```

Expected: `next build` succeeds and prints the route table with `○ /` (static). `next-env.d.ts` is generated — commit it. Verify GA is wired into the prod bundle:

```bash
pnpm start &
sleep 2
curl -s http://localhost:3000/ | grep -o "G-RX37WJZFSQ" | head -1   # expect G-RX37WJZFSQ
kill %1
```

- [ ] **Step 10: Commit**

```bash
git add -A landing
git commit -m "feat(landing): Next.js 15 scaffold — root layout, GA4, constants, globals.css"
```

---

### Task 2: Port the existing pages to React components (visual parity)

Decompose the current `landing/index.html` (commit `8af1c11`) into components with **unchanged copy** (exception: the placeholder "Featured on" section is dropped per spec). Port `thanks.html`. Point the field-guide generator at `public/`.

**Files:**
- Create: `landing/src/components/Nav/{index.ts,Nav.tsx}`, `landing/src/components/Footer/{index.ts,Footer.tsx}`
- Create: `landing/src/components/home/<Section>/{index.ts,<Section>.tsx}` for `Hero`, `TagStrip`, `FeatureRows`, `MiniCards`, `Audience`, `Pricing`, `Faq`, `FooterCta`
- Modify: `landing/src/app/page.tsx`
- Create: `landing/src/app/thanks/page.tsx`
- Modify: `landing/scripts/build-field-guide.mjs`
- Delete: `landing/index.html`, `landing/thanks.html`, `landing/field-guide.html`

**Interfaces:**
- Consumes: layout from Task 1.
- Produces: `<Nav />` and `<Footer />` (no props) used by every page; prop-less `home/*` section components composed by `page.tsx`. All internal anchor hrefs become absolute (`/#features`, `/#pricing`, `/#faq`, `/#hero`) so they work from blog pages.

- [ ] **Step 1: Create `Nav` and `Footer`**

`Nav.tsx`: port lines 25–38 of `landing/index.html` per the JSX rules; make hrefs absolute: `#hero`→`/#hero`, `#features`→`/#features`, `#pricing`→`/#pricing`, `#faq`→`/#faq` (5 hrefs total including the Download button). Server component (no `"use client"`).

`Footer.tsx`: port lines 270–286; same href replacements; replace the year span with `const year = new Date().getFullYear();` in the component body and `<span>© {year} Prompt Janitor — All rights reserved</span>` (rendered at build time — fine for a yearly-changing value).

Each gets an `index.ts` re-export (`export { Nav } from "./Nav";` pattern, same for every component below).

- [ ] **Step 2: Create the eight `home/` section components** by porting these line ranges of `landing/index.html` (JSX rules, copy text unchanged):

| Component | index.html lines | Section |
|---|---|---|
| `home/Hero/Hero.tsx` | 42–61 | `<header className="hero">` |
| `home/TagStrip/TagStrip.tsx` | 64–81 | "Visibility you've never had" |
| `home/FeatureRows/FeatureRows.tsx` | 84–124 | alternating features |
| `home/MiniCards/MiniCards.tsx` | 127–146 | `.cards2` |
| `home/Audience/Audience.tsx` | 149–164 | audience grid |
| `home/Pricing/Pricing.tsx` | 167–220 | pricing + guarantee |
| `home/Faq/Faq.tsx` | 223–243 | FAQ accordion |
| `home/FooterCta/FooterCta.tsx` | 259–266 | "Grade once. Stay sharp." |

Lines 246–256 ("Featured on" placeholder badges) are **not ported** — deleted per spec.

`Faq.tsx` becomes a client component with the accordion behavior (previously in `main.js`). Structure it as data + render so Task 5 can edit Q&A easily:

```tsx
"use client";

import { useState, type ReactNode } from "react";

interface FaqItem {
  q: string;
  a: ReactNode;
}

const ITEMS: FaqItem[] = [
  // one entry per .acc item from index.html lines 230–240, e.g.:
  {
    q: "What does Prompt Janitor scan?",
    a: (
      <>
        Prompt and agent-instruction files in the folders you choose —{" "}
        <span style={{ fontFamily: "var(--mono)", fontSize: ".9em" }}>AGENTS.md</span>,{" "}
        <span style={{ fontFamily: "var(--mono)", fontSize: ".9em" }}>CLAUDE.md</span>,{" "}
        <span style={{ fontFamily: "var(--mono)", fontSize: ".9em" }}>.cursorrules</span> and more.
      </>
    ),
  },
  // …port the remaining 10 items' text verbatim…
];

export function Faq() {
  const [open, setOpen] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <section className="section tint" id="faq">
      <div className="wrap">
        <div className="section-head">
          <h2>Frequently asked questions</h2>
          <p>Privacy, compatibility, and how grading actually works.</p>
        </div>
        <div className="faq" id="faqList">
          {ITEMS.map((item, i) => (
            <div className={open.has(i) ? "acc open" : "acc"} key={item.q}>
              <button className="acc-q" aria-expanded={open.has(i)} onClick={() => toggle(i)}>
                {item.q}
                <span className="pm" aria-hidden="true">
                  +
                </span>
              </button>
              <div className="acc-a">
                <div>{item.a}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

The Polar wiring from `main.js` is intentionally NOT ported (spec: no Polar on the page). In `Pricing.tsx`, port the Pro button (index.html line 208) as a plain anchor for now (rewired to waitlist in Task 5):

```tsx
<a className="btn" href="/#pricing">Get Pro — $69</a>
```

- [ ] **Step 3: Rewrite `landing/src/app/page.tsx`**

```tsx
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/home/Hero";
import { TagStrip } from "@/components/home/TagStrip";
import { FeatureRows } from "@/components/home/FeatureRows";
import { MiniCards } from "@/components/home/MiniCards";
import { Audience } from "@/components/home/Audience";
import { Pricing } from "@/components/home/Pricing";
import { Faq } from "@/components/home/Faq";
import { FooterCta } from "@/components/home/FooterCta";

export default function Home() {
  return (
    <>
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
    </>
  );
}
```

- [ ] **Step 4: Create `landing/src/app/thanks/page.tsx`**

Port `landing/thanks.html`: lines 56–82 (`<main>…</main>`) per the JSX rules, wrapped with `<Nav />` / `<Footer />`. The page-specific `<style>` block (lines 15–36) moves to a `thanks.css` file in the same folder, imported by the page (`import "./thanks.css";`). Page metadata:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "You're in. — Prompt Janitor",
  description: "Thanks for grabbing Prompt Janitor Pro. Your license key is on its way — here's how to activate it.",
  robots: { index: false },
};
```

- [ ] **Step 5: Point the field-guide generator at `public/`**

In `landing/scripts/build-field-guide.mjs`:
1. Change the output path constant from `landing/field-guide.html` to `landing/public/field-guide.html` (the script resolves paths relative to itself — adjust the existing resolve call accordingly).
2. In its HTML template, replace `<link rel="stylesheet" href="/src/styles.css" />` with an inlined stylesheet: read the CSS at build time (`const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");`) and emit `<style>${css}</style>`.
3. Remove the `<script type="module" src="/src/main.js"></script>` line from the template if present (inline any year-stamping it did with a literal year).

```bash
git rm landing/index.html landing/thanks.html landing/field-guide.html
```

- [ ] **Step 6: Build and verify parity**

```bash
cd landing && pnpm build && pnpm start &
sleep 2
curl -s http://localhost:3000/ | grep -c "Diagnosis free. Treatment paid."      # expect 1
curl -s http://localhost:3000/ | grep -c "badge-slot"                           # expect 0 (featured-on gone)
curl -s http://localhost:3000/thanks | grep -c "Your license key is on its way" # expect 1
curl -s http://localhost:3000/field-guide.html | grep -c "<style>"              # expect ≥1 (inlined CSS)
kill %1
```

Also open `http://localhost:3000/` in a browser if available and confirm the page looks identical to the pre-migration landing (hero shot, tags, alternating features, pricing cards, FAQ open/close works).

- [ ] **Step 7: Commit**

```bash
git add -A landing
git commit -m "feat(landing): port landing/thanks to React components at visual parity; drop featured-on + Polar wiring"
```

---

### Task 3: Blog infrastructure (markdown lib, pages, RSS, sitemap)

**Files:**
- Create: `landing/src/lib/blog.ts`
- Test: `landing/src/lib/blog.test.ts`
- Create: `landing/src/app/blog/page.tsx`
- Create: `landing/src/app/blog/[slug]/page.tsx`
- Create: `landing/src/app/rss.xml/route.ts`
- Create: `landing/src/app/sitemap.ts`
- Create: `landing/content/blog/.gitkeep` (posts arrive in Tasks 6–8)
- Create: `landing/src/components/WaitlistForm/{index.ts,WaitlistForm.tsx,WaitlistForm.types.ts}` (stub — Task 5 fills in the real component; types file is final now)
- Modify: `landing/src/app/globals.css` (append blog styles)
- Modify: `landing/src/components/Nav/Nav.tsx`, `landing/src/components/Footer/Footer.tsx` (Blog links)

**Interfaces:**
- Produces: `getAllPosts(): Promise<PostMeta[]>` (non-draft, sorted desc by `pubDate`) and `getPost(slug: string): Promise<Post>` where `PostMeta = { slug: string; title: string; description: string; pubDate: Date; tags: string[] }` and `Post = PostMeta & { html: string }`; URLs `/blog`, `/blog/<slug>`, `/rss.xml`, `/sitemap.xml`. Tasks 6–8 only add `.md` files under `landing/content/blog/`.
- Produces: `WaitlistFormProps = { source: string; buttonLabel?: string; compact?: boolean }`.

- [ ] **Step 1: Write the failing blog-lib test — `landing/src/lib/blog.test.ts`**

```ts
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadPosts } from "./blog";

async function fixtureDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pj-blog-"));
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "older-post.md"),
    `---\ntitle: "Older"\ndescription: "old"\npubDate: 2026-07-01\ntags: ["a"]\n---\nBody **old**.\n`,
  );
  await writeFile(
    path.join(dir, "newer-post.md"),
    `---\ntitle: "Newer"\ndescription: "new"\npubDate: 2026-07-10\n---\nBody _new_.\n`,
  );
  await writeFile(
    path.join(dir, "hidden-post.md"),
    `---\ntitle: "Hidden"\ndescription: "x"\npubDate: 2026-07-05\ndraft: true\n---\nnope\n`,
  );
  return dir;
}

describe("loadPosts", () => {
  it("skips drafts and sorts newest first, slug = filename", async () => {
    const posts = await loadPosts(await fixtureDir());
    expect(posts.map((p) => p.slug)).toEqual(["newer-post", "older-post"]);
    expect(posts[0].title).toBe("Newer");
    expect(posts[1].tags).toEqual(["a"]);
    expect(posts[0].pubDate).toBeInstanceOf(Date);
  });

  it("renders markdown to HTML", async () => {
    const posts = await loadPosts(await fixtureDir());
    const older = posts.find((p) => p.slug === "older-post")!;
    expect(older.html).toContain("<strong>old</strong>");
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd landing && pnpm test
```

Expected: FAIL — `Cannot find module './blog'` (or missing export `loadPosts`).

- [ ] **Step 3: Implement `landing/src/lib/blog.ts`**

```ts
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkHtml from "remark-html";

export interface PostMeta {
  slug: string;
  title: string;
  description: string;
  pubDate: Date;
  tags: string[];
}

export interface Post extends PostMeta {
  html: string;
}

const BLOG_DIR = path.join(process.cwd(), "content/blog");

/** Testable core: reads every .md in a directory, skips drafts, sorts desc. */
export async function loadPosts(dir: string): Promise<Post[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".md"));
  const posts = await Promise.all(
    files.map(async (file) => {
      const raw = await readFile(path.join(dir, file), "utf8");
      const { data, content } = matter(raw);
      if (data.draft === true) return null;
      const html = String(await remark().use(remarkHtml).process(content));
      return {
        slug: file.replace(/\.md$/, ""),
        title: String(data.title),
        description: String(data.description),
        pubDate: new Date(data.pubDate),
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
        html,
      } satisfies Post;
    }),
  );
  return posts
    .filter((p): p is Post => p !== null)
    .sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());
}

export async function getAllPosts(): Promise<Post[]> {
  return loadPosts(BLOG_DIR);
}

export async function getPost(slug: string): Promise<Post> {
  const post = (await getAllPosts()).find((p) => p.slug === slug);
  if (!post) throw new Error(`Unknown blog post: ${slug}`);
  return post;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test
```

Expected: 2 passing.

- [ ] **Step 5: Create the `WaitlistForm` stub** (real component in Task 5; the types file is already final)

`WaitlistForm.types.ts`:

```ts
export interface WaitlistFormProps {
  source: string;
  buttonLabel?: string;
  compact?: boolean;
}
```

`WaitlistForm.tsx`:

```tsx
import type { WaitlistFormProps } from "./WaitlistForm.types";

export function WaitlistForm({ source }: WaitlistFormProps) {
  return <p className="wl-msg" data-source={source}>Waitlist opens soon.</p>;
}
```

`index.ts`:

```ts
export { WaitlistForm } from "./WaitlistForm";
export type { WaitlistFormProps } from "./WaitlistForm.types";
```

- [ ] **Step 6: Create `landing/src/app/blog/page.tsx`**

```tsx
import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog — Prompt Janitor",
  description: "Field notes on prompt files, agent context, and measuring what actually works.",
};

const dateLabel = (d: Date) =>
  d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

export default async function BlogIndex() {
  const posts = await getAllPosts();
  return (
    <>
      <Nav />
      <main id="main">
        <section className="section">
          <div className="wrap" style={{ maxWidth: 760 }}>
            <div className="section-head">
              <div className="eyebrow">Blog</div>
              <h2 style={{ marginTop: 12 }}>Field notes on prompt health</h2>
              <p>Practical writing about prompt files, agent context, and evidence over vibes.</p>
            </div>
            <div className="post-list">
              {posts.map((post) => (
                <a className="post-card" href={`/blog/${post.slug}`} key={post.slug}>
                  <div className="faint post-date">{dateLabel(post.pubDate)}</div>
                  <h3>{post.title}</h3>
                  <p className="muted">{post.description}</p>
                  <span className="post-more">Read →</span>
                </a>
              ))}
              {posts.length === 0 && (
                <p className="muted" style={{ textAlign: "center" }}>
                  First posts landing shortly.
                </p>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 7: Create `landing/src/app/blog/[slug]/page.tsx`**

```tsx
import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WaitlistForm } from "@/components/WaitlistForm";
import { getAllPosts, getPost } from "@/lib/blog";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getAllPosts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  return {
    title: `${post.title} — Prompt Janitor`,
    description: post.description,
    openGraph: { type: "article" },
  };
}

const dateLabel = (d: Date) =>
  d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  return (
    <>
      <Nav />
      <main id="main">
        <article className="section" style={{ paddingTop: 64 }}>
          <div className="wrap">
            <header className="post-header">
              <div className="eyebrow">Blog · {dateLabel(post.pubDate)}</div>
              <h1>{post.title}</h1>
              <p className="lead" style={{ maxWidth: 600, margin: "20px auto 0", color: "var(--ink-2)", fontSize: 19 }}>
                {post.description}
              </p>
            </header>
            <div className="prose" dangerouslySetInnerHTML={{ __html: post.html }} />
            <div className="post-cta">
              <h3 style={{ fontSize: 26 }}>Prompt Janitor is launching soon</h3>
              <p className="muted" style={{ margin: "12px 0 0" }}>
                Scan, grade, and fix every prompt file on your Mac. Waitlist members lock in founder pricing — $69
                instead of $99.
              </p>
              <WaitlistForm source={`blog-${post.slug}`} />
            </div>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 8: Create RSS route and sitemap**

`landing/src/app/rss.xml/route.ts`:

```ts
import { getAllPosts } from "@/lib/blog";
import { SITE_URL } from "@/lib/constants";

export const dynamic = "force-static";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET() {
  const posts = await getAllPosts();
  const items = posts
    .map(
      (p) => `    <item>
      <title>${esc(p.title)}</title>
      <description>${esc(p.description)}</description>
      <link>${SITE_URL}/blog/${p.slug}</link>
      <guid>${SITE_URL}/blog/${p.slug}</guid>
      <pubDate>${p.pubDate.toUTCString()}</pubDate>
    </item>`,
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Prompt Janitor Blog</title>
    <description>Field notes on prompt files, agent context, and measuring what actually works.</description>
    <link>${SITE_URL}</link>
${items}
  </channel>
</rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
```

`landing/src/app/sitemap.ts`:

```ts
import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";
import { SITE_URL } from "@/lib/constants";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPosts();
  return [
    { url: `${SITE_URL}/`, lastModified: new Date() },
    { url: `${SITE_URL}/blog`, lastModified: new Date() },
    ...posts.map((p) => ({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: p.pubDate })),
  ];
}
```

- [ ] **Step 9: Append blog styles to `landing/src/app/globals.css`**

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

- [ ] **Step 10: Add Blog links**

`Nav.tsx`: inside `.nav-links`, after the Pricing link, add `<a href="/blog">Blog</a>`.
`Footer.tsx`: change the Company column to:

```tsx
<div>
  <h5>Resources</h5>
  <a href="/blog">Blog</a>
  <a href="/rss.xml">RSS</a>
  <a href="mailto:prompt-janitor@studiotristar.com">Contact</a>
</div>
```

and delete the Legal column. In `globals.css`, change `.footer-cols` to `grid-template-columns: 1.4fr 1fr 1fr;`.

- [ ] **Step 11: Build and verify**

```bash
cd landing && pnpm build && pnpm start &
sleep 2
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/blog        # expect 200
curl -s http://localhost:3000/rss.xml | head -3                            # expect <?xml … <rss
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/sitemap.xml # expect 200
kill %1
```

Expected: build passes with an empty collection; blog index renders the "First posts landing shortly." empty state.

- [ ] **Step 12: Commit**

```bash
git add -A landing
git commit -m "feat(landing): blog infrastructure — markdown lib (TDD), index/post pages, RSS, sitemap"
```

---

### Task 4: Waitlist API route (`/api/subscribe`)

Same-origin Next route holding the Resend key server-side. TDD on the pure logic. Two Resend emails per signup, no Audience.

**Files:**
- Create: `landing/src/lib/waitlist/validate.ts`, `landing/src/lib/waitlist/emails.ts`
- Test: `landing/src/lib/waitlist/validate.test.ts`, `landing/src/lib/waitlist/emails.test.ts`
- Create: `landing/src/app/api/subscribe/route.ts`

**Interfaces:**
- Produces: HTTP `POST /api/subscribe` accepting JSON `{ email: string, source: string, website?: string }` → `200 {"ok":true}` | `400 {"error":…}` | `503` (no key) | `502` (Resend rejected). The `WaitlistForm` (Task 5) calls it with a relative URL.
- Internal: `validateSubscribe(body: unknown): { ok: true; email: string; source: string; bot: boolean } | { ok: false; error: string }`; `buildEmails(email: string, source: string): EmailPayload[]` (exactly 2 payloads: `[confirmation, ownerNotification]`, identities from `@/lib/constants`).

- [ ] **Step 1: Write the failing validation tests — `landing/src/lib/waitlist/validate.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { validateSubscribe } from "./validate";

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

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd landing && pnpm test
```

Expected: FAIL — `Cannot find module './validate'`.

- [ ] **Step 3: Implement `landing/src/lib/waitlist/validate.ts`**

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

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test
```

Expected: validate tests pass (plus the 2 blog tests from Task 3).

- [ ] **Step 5: Write the failing email-builder tests — `landing/src/lib/waitlist/emails.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { buildEmails } from "./emails";
import { FROM_EMAIL, OWNER_EMAIL } from "@/lib/constants";

describe("buildEmails", () => {
  it("builds exactly a confirmation and an owner notification", () => {
    const [confirm, notify] = buildEmails("dev@example.com", "pricing-pro");
    expect(confirm.to).toEqual(["dev@example.com"]);
    expect(confirm.from).toBe(FROM_EMAIL);
    expect(confirm.subject).toContain("waitlist");
    expect(confirm.text).toContain("$69");
    expect(confirm.text).toContain("https://promptjanitor.app");

    expect(notify.to).toEqual([OWNER_EMAIL]);
    expect(notify.subject).toBe("Waitlist signup: dev@example.com (pricing-pro)");
    expect(notify.text).toContain("dev@example.com");
    expect(notify.text).toContain("pricing-pro");
  });
});
```

Note: vitest needs the `@/` alias — add to `landing/package.json` devDependencies `"vite-tsconfig-paths": "^5.1.0"` and create `landing/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
});
```

Run `pnpm install` after editing package.json.

- [ ] **Step 6: Run to verify failure, then implement `landing/src/lib/waitlist/emails.ts`**

Run: `pnpm test` — expected: FAIL, `Cannot find module './emails'`. Then:

```ts
import { FROM_EMAIL, OWNER_EMAIL, SITE_URL } from "@/lib/constants";

export interface EmailPayload {
  from: string;
  to: string[];
  subject: string;
  text: string;
}

export function buildEmails(email: string, source: string): EmailPayload[] {
  const confirmation: EmailPayload = {
    from: FROM_EMAIL,
    to: [email],
    subject: "You're on the Prompt Janitor waitlist ✅",
    text: [
      "You're in!",
      "",
      "Thanks for joining the Prompt Janitor waitlist. Here's what happens next:",
      "",
      "1. You'll get exactly one email when the app ships — the download link, nothing else.",
      "2. Founder pricing is locked in for you: Pro for $69 instead of $99. One-time, no subscription.",
      `3. Meanwhile, we publish field notes on prompt health: ${SITE_URL}/blog`,
      "",
      "No drip campaigns, no spam. Reply to this email any time — a human reads it.",
      "",
      "— Prompt Janitor",
      SITE_URL,
    ].join("\n"),
  };
  const notification: EmailPayload = {
    from: FROM_EMAIL,
    to: [OWNER_EMAIL],
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

Run: `pnpm test` — expected: all tests pass (blog + validate + emails).

- [ ] **Step 7: Implement `landing/src/app/api/subscribe/route.ts`**

```ts
import { NextResponse } from "next/server";
import { validateSubscribe } from "@/lib/waitlist/validate";
import { buildEmails, sendEmails } from "@/lib/waitlist/emails";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const result = validateSubscribe(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  if (result.bot) return NextResponse.json({ ok: true }); // honeypot: pretend success, send nothing

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set");
    return NextResponse.json({ error: "email delivery unavailable" }, { status: 503 });
  }

  const res = await sendEmails(buildEmails(result.email, result.source), apiKey);
  if (!res.ok) {
    console.error("resend error", res.status, await res.text());
    return NextResponse.json({ error: "email delivery failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 8: Smoke-test with `next dev`**

```bash
cd landing && pnpm dev &   # wait for "Ready"
sleep 5
curl -s -X POST localhost:3000/api/subscribe -H 'Content-Type: application/json' -d '{"email":"nope","source":"hero"}'
# expect: {"error":"invalid email"} (400)
curl -s -X POST localhost:3000/api/subscribe -H 'Content-Type: application/json' -d '{"email":"a@b.co","source":"hero","website":"spam"}'
# expect: {"ok":true} (honeypot short-circuit, no Resend call)
curl -s -X POST localhost:3000/api/subscribe -H 'Content-Type: application/json' -d '{"email":"a@b.co","source":"hero"}'
# expect: {"error":"email delivery failed"} (502 — .env.local dummy key rejected by Resend; proves wiring)
kill %1
```

- [ ] **Step 9: Commit**

```bash
git add -A landing
git commit -m "feat(landing): /api/subscribe — Resend confirmation + owner notification (TDD'd validation/emails)"
```

---

### Task 5: Waitlist form + landing copy rework

Turn the parity port into the pre-launch page: waitlist-first CTAs, new hero, evidence strip, how-it-works, philosophy strip, FAQ updates.

**Files:**
- Rewrite: `landing/src/components/WaitlistForm/WaitlistForm.tsx` (replaces Task 3's stub; `WaitlistForm.types.ts` unchanged)
- Create: `landing/src/components/home/EvidenceStrip/{index.ts,EvidenceStrip.tsx}`, `home/HowItWorks/{index.ts,HowItWorks.tsx}`, `home/Philosophy/{index.ts,Philosophy.tsx}`
- Modify: `landing/src/components/home/Hero/Hero.tsx`, `home/Pricing/Pricing.tsx`, `home/Faq/Faq.tsx`, `home/FooterCta/FooterCta.tsx`, `landing/src/components/Nav/Nav.tsx`
- Modify: `landing/src/app/page.tsx`
- Modify: `landing/src/app/globals.css` (append CSS below)

**Interfaces:**
- Consumes: `/api/subscribe` from Task 4; `WaitlistFormProps` from Task 3.
- Produces: the real `WaitlistForm` — used by Hero (`hero`), Pricing (`pricing-free`/`pricing-pro`), FooterCta (`footer`), blog post page (`blog-<slug>`, already wired in Task 3).

- [ ] **Step 1: Rewrite `landing/src/components/WaitlistForm/WaitlistForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { sendGAEvent } from "@next/third-parties/google";
import { CONTACT_EMAIL } from "@/lib/constants";
import type { WaitlistFormProps } from "./WaitlistForm.types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Status = "idle" | "busy" | "ok" | "err";

export function WaitlistForm({ source, buttonLabel = "Join the waitlist", compact = false }: WaitlistFormProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
    const website = (form.elements.namedItem("website") as HTMLInputElement).value;

    if (!EMAIL_RE.test(email)) {
      setStatus("err");
      setMessage("That email doesn't look right — mind checking it?");
      return;
    }

    setStatus("busy");
    setMessage("Adding you…");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source, website }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      sendGAEvent("event", "waitlist_submit", { source });
      setStatus("ok");
      setMessage("You're on the list — confirmation email on its way ✅");
      form.reset();
    } catch {
      setStatus("err");
      setMessage(`Something went wrong — email us instead: ${CONTACT_EMAIL}`);
    }
  }

  return (
    <form className={compact ? "wl-form compact" : "wl-form"} onSubmit={onSubmit} noValidate>
      <input type="email" name="email" required placeholder="you@example.com" aria-label="Email address" autoComplete="email" />
      <input type="text" name="website" className="wl-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <button className="btn" type="submit" disabled={status === "busy"}>
        {buttonLabel}
      </button>
      <p className={status === "ok" ? "wl-msg ok" : status === "err" ? "wl-msg err" : "wl-msg"} role="status" aria-live="polite">
        {message}
      </p>
    </form>
  );
}
```

- [ ] **Step 2: Append CSS to `landing/src/app/globals.css`**

```css
/* ---------- waitlist form ---------- */
.wl-form { position: relative; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 30px; }
.wl-form input[type="email"] { font: inherit; font-size: 16px; padding: 12px 18px; min-width: 280px; border-radius: var(--r-pill); border: 1px solid var(--line-2); background: #fff; box-shadow: var(--shadow-sm); }
.wl-form input[type="email"]:focus { border-color: var(--blue); outline: none; }
.wl-hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
.wl-msg { width: 100%; text-align: center; font-size: 14.5px; margin: 10px 0 0; min-height: 1.4em; color: var(--ink-2); }
.wl-msg.ok { color: #1d7a3e; font-weight: 600; }
.wl-msg.err { color: var(--red); }
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

- [ ] **Step 3: Rework `home/Hero/Hero.tsx`**

Replace the component body with (hero-shot block and trust-check SVG markup carried over from the ported version):

```tsx
import { WaitlistForm } from "@/components/WaitlistForm";

export function Hero() {
  return (
    <header className="hero" id="hero">
      <div className="wrap">
        <div className="eyebrow">macOS app · runs 100% locally · launching soon</div>
        <h1 style={{ marginTop: 16 }}>
          Know in 10 seconds
          <br />
          if your prompts are good enough.
        </h1>
        <p className="lead">
          Prompt Janitor scans every <span style={{ fontFamily: "var(--mono)", fontSize: ".92em" }}>AGENTS.md</span> and{" "}
          <span style={{ fontFamily: "var(--mono)", fontSize: ".92em" }}>CLAUDE.md</span> on your Mac, grades them A–F
          against the industry's own standards, and flags what's rotting — before your agents trip on it.
        </p>
        <WaitlistForm source="hero" />
        <div className="trust">
          {/* keep the four existing ✓ spans from the ported version, but replace the last one
              ("30-day grade-up guarantee") with: */}
          <span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="5 12.5 10 17.5 19 7" />
            </svg>{" "}
            Founder pricing locked: $69
          </span>
        </div>
        {/* .hero-shot block unchanged */}
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Create `home/EvidenceStrip/EvidenceStrip.tsx`**

```tsx
export function EvidenceStrip() {
  return (
    <section className="section tint evidence" id="evidence">
      <div className="wrap">
        <div className="section-head">
          <div className="eyebrow">Evidence, not vibes</div>
          <h2 style={{ marginTop: 12 }}>We measure what bad prompts actually cost.</h2>
          <p>
            We run controlled benchmarks: the same coding task, the same agent, one prompt defect apart. Then we count
            the damage.
          </p>
        </div>
        <div className="ev-stats">
          <div className="ev-stat">
            <div className="n">+36k</div>
            <div className="l">
              tokens burned per task
              <br />
              with one defective prompt
            </div>
          </div>
          <div className="ev-stat">
            <div className="n">+0.8</div>
            <div className="l">
              extra agent turns
              <br />
              to finish the same task
            </div>
          </div>
          <div className="ev-stat">
            <div className="n">−0.4</div>
            <div className="l">
              major review issues
              <br />
              after the prompt was fixed
            </div>
          </div>
        </div>
        <p className="ev-caveat">
          Early numbers from our first controlled runs (N=5) — not yet statistically significant, and we say so. The
          full powered benchmark runs next, and we're publishing everything, methodology included.
        </p>
        <a className="ev-link" href="/blog/what-a-bad-prompt-actually-costs">
          Read the methodology →
        </a>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Create `home/HowItWorks/HowItWorks.tsx`**

```tsx
export function HowItWorks() {
  return (
    <section className="section" id="how">
      <div className="wrap">
        <div className="section-head">
          <h2>Scan. Grade. Treat.</h2>
          <p>Diagnosis is free forever. Treatment is what you pay for.</p>
        </div>
        <div className="how">
          <div className="how-step">
            <span className="n" aria-hidden="true">1</span>
            <h4>Scan</h4>
            <p>
              Point it at your projects. It finds every prompt file — <code>CLAUDE.md</code>, <code>AGENTS.md</code>,{" "}
              <code>.cursorrules</code> — and rescans on a schedule.
            </p>
          </div>
          <div className="how-step">
            <span className="n" aria-hidden="true">2</span>
            <h4>Grade</h4>
            <p>
              Each file gets an A–F health grade against source-cited standards from Anthropic, OpenAI, and the
              practitioners who wrote the playbook.
            </p>
          </div>
          <div className="how-step">
            <span className="n" aria-hidden="true">3</span>
            <h4>Treat</h4>
            <p>
              Pro rewrites the weak parts with AI — apply with a backup, one-click undo, and an optional git branch so
              changes stay reviewable.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Create `home/Philosophy/Philosophy.tsx`**

```tsx
export function Philosophy() {
  return (
    <section className="section tint philosophy">
      <div className="wrap">
        <div className="eyebrow">Why we're building this</div>
        <blockquote>
          “Prompt files are infrastructure.
          <br />
          Nobody inspects them.”
        </blockquote>
        <p className="who">
          Your agents read these files on every single run — yet there's no linter, no review, no grade. We think
          diagnosis should be free, for everyone, forever. Treatment is what you pay for.
        </p>
        <a className="ev-link" href="/blog/diagnosis-should-be-free">
          Read the manifesto →
        </a>
      </div>
    </section>
  );
}
```

- [ ] **Step 7: Rework `home/Pricing/Pricing.tsx` CTAs**

Add `import { WaitlistForm } from "@/components/WaitlistForm";`.

Free card — replace the `<a className="btn ghost" href="#">… Download for macOS</a>` and the `price-note` under it with:

```tsx
<WaitlistForm source="pricing-free" compact buttonLabel="Join the waitlist" />
<p className="price-note">Launching soon — the waitlist gets the download first. No payment, no account.</p>
```

Pro card — replace the `Get Pro — $69` anchor and the two `price-note` paragraphs with:

```tsx
<WaitlistForm source="pricing-pro" compact buttonLabel="Join — lock in $69" />
<p className="price-note">
  Founder pricing is locked for waitlist members at launch.
  <br />
  One-time purchase: perpetual license + 12 months of updates · $29/yr optional renewal, never required.
</p>
```

Keep the guarantee block unchanged.

- [ ] **Step 8: Update `home/Faq/Faq.tsx`**

Insert two new items at the TOP of the `ITEMS` array:

```tsx
{
  q: "When does it launch?",
  a: "Soon — Prompt Janitor is in pre-launch. Join the waitlist and you'll get the download link the moment it ships, with founder pricing ($69 instead of $99) locked in.",
},
{
  q: "What happens when I join the waitlist?",
  a: "You get one confirmation email right away, and one email when the app launches. That's the whole campaign — no drip sequences, and you can unsubscribe any time.",
},
```

Change the LAST item's answer (`How do I get the app?`) to: `It's pre-launch. Join the waitlist and you'll be scanning within a minute of the launch email — no account, no sign-up.`

- [ ] **Step 9: Rework `home/FooterCta/FooterCta.tsx` and `Nav/Nav.tsx`**

`FooterCta.tsx`: add `import { WaitlistForm } from "@/components/WaitlistForm";`; replace the `<a className="btn" …>Download for macOS</a>` with `<WaitlistForm source="footer" />`; change the `<p>` to `Give your prompts the visibility layer they've been missing — waitlist members launch first, at founder pricing.`

`Nav.tsx`: replace the Download button with `<a className="btn sm" href="/#hero">Join waitlist</a>` (drop the download-arrow SVG).

- [ ] **Step 10: Update `page.tsx` section order**

```tsx
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

(Add the three new imports. Section backgrounds alternate acceptably: EvidenceStrip and Philosophy carry `tint`; HowItWorks/MiniCards/Pricing/FooterCta are white; TagStrip stays white and FeatureRows/Audience/Faq keep their existing `tint`.)

- [ ] **Step 11: Build and verify**

```bash
cd landing && pnpm build && pnpm start &
sleep 2
H=$(curl -s http://localhost:3000/)
echo "$H" | grep -c "Know in 10 seconds"                 # expect ≥1
echo "$H" | grep -c "wl-form"                            # expect ≥4 (hero, 2 pricing, footer)
echo "$H" | grep -c "not yet statistically significant"  # expect 1
echo "$H" | grep -c "data-polar-checkout"                # expect 0
echo "$H" | grep -c "When does it launch?"               # expect 1
kill %1
```

Browser check with `pnpm dev`: hero form → invalid email shows the inline error; valid email with the dummy `.env.local` key returns 502 → the mailto fallback message appears (designed failure mode until the real key exists on Vercel); honeypot untouched so real submits proceed.

- [ ] **Step 12: Commit**

```bash
git add -A landing
git commit -m "feat(landing): waitlist-first rework — hero, evidence strip, how-it-works, philosophy, pricing/FAQ/nav CTAs"
```

---

### Task 6: Blog post — "The 7 defects that quietly poison your agent's context"

**Files:**
- Create: `landing/content/blog/seven-defects-that-poison-your-agents-context.md`

**Interfaces:**
- Consumes: blog lib from Task 3. Cross-check each defect against `docs/standards/prompting-standards.md` (the 25-standard catalog) and keep the citations accurate; adjust attribution wording if the catalog attributes a standard differently.

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

You describe the output you want in prose, and the agent gives you something adjacent to it. One good example beats three paragraphs of description — few-shot examples are the single most reliable way to pin down format and tone, and both Anthropic and OpenAI put examples near the top of their prompting guidance. This is also the defect we chose for our first controlled benchmark run, precisely because it's so common. [Early numbers here](/blog/what-a-bad-prompt-actually-costs).

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
```

Expected: route table now shows `● /blog/[slug]` with `/blog/seven-defects-that-poison-your-agents-context`. Then:

```bash
pnpm start &
sleep 2
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/blog/seven-defects-that-poison-your-agents-context  # expect 200
curl -s http://localhost:3000/rss.xml | grep -c "seven-defects"   # expect ≥1
kill %1
```

- [ ] **Step 3: Commit**

```bash
git add landing/content/blog/seven-defects-that-poison-your-agents-context.md
git commit -m "content(blog): the 7 defects that poison agent context"
```

---

### Task 7: Blog post — "We measured what a bad prompt actually costs"

**Files:**
- Create: `landing/content/blog/what-a-bad-prompt-actually-costs.md`

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
cd landing && pnpm build && pnpm start &
sleep 2
curl -s http://localhost:3000/blog/what-a-bad-prompt-actually-costs | grep -c "none of this is statistically significant"  # expect 1
kill %1
```

(The evidence-strip link on the landing page now resolves — click through in dev.)

- [ ] **Step 3: Commit**

```bash
git add landing/content/blog/what-a-bad-prompt-actually-costs.md
git commit -m "content(blog): benchmark methodology + honest first numbers"
```

---

### Task 8: Blog post — "Diagnosis should be free"

**Files:**
- Create: `landing/content/blog/diagnosis-should-be-free.md`

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

**The benchmark keeps us honest.** We're [measuring what prompt defects actually cost](/blog/what-a-bad-prompt-actually-costs) with controlled experiments, and publishing methodology, confidence intervals, and null results alike. If a rule doesn't demonstrably matter, it gets demoted — free users get the same standards updates as paying ones.

## What you pay for: treatment

Diagnosis tells you the file is a D. Treatment is the work of making it an A — and that's Pro: AI rewrites of the weak parts, one-click apply with backup and undo, your own standards enforced in plain English, starter templates per stack. A one-time $69 purchase (founder pricing), perpetual license, no subscription. If your prompt health doesn't rise a full letter grade in 30 days, full refund.

Free tells you the truth. Pro fixes it. We think that's the only honest way to build this category.

---

Prompt Janitor is launching soon on macOS. The scanner — the whole diagnosis layer — will be free from day one.
```

- [ ] **Step 2: Build and verify**

```bash
cd landing && pnpm build && pnpm start &
sleep 2
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/blog/diagnosis-should-be-free  # expect 200
curl -s http://localhost:3000/ | grep -c 'href="/blog/'   # expect ≥2 (evidence + philosophy links resolve)
kill %1
```

- [ ] **Step 3: Commit**

```bash
git add landing/content/blog/diagnosis-should-be-free.md
git commit -m "content(blog): diagnosis-should-be-free manifesto"
```

---

### Task 9: Docs, workflow cleanup, UTM convention, final verification, PR

**Files:**
- Modify: `landing/README.md`
- Create: `docs/marketing/utm-convention.md`
- Delete: `.github/workflows/landing.yml` (GitHub Pages deploy retired — Vercel deploys on push; the `landing` build-check job in `.github/workflows/ci.yml` stays and keeps working since it just runs `pnpm install && pnpm build`)

- [ ] **Step 1: Rewrite `landing/README.md`**

```markdown
# Prompt Janitor — marketing site

Next.js 15 (App Router) pre-launch site: waitlist-first landing + blog.
Deployed on **Vercel** (project root directory = `landing/`), custom domain
`promptjanitor.app`. Deliberately outside the app's pnpm workspace (own
pnpm-workspace.yaml).

## Develop
pnpm install
echo 'RESEND_API_KEY=re_dummy_local' > .env.local
pnpm dev            # localhost:3000
pnpm test           # vitest (blog lib + waitlist validation/emails)
pnpm build          # runs the field-guide generator, then next build

## Structure
- src/app/               pages (/, /thanks, /blog, /blog/[slug], /rss.xml, sitemap), api/subscribe
- src/components/        Nav, Footer, WaitlistForm, AnalyticsClicks + home/* sections
                         (folder per component: index.ts + Component.tsx + .types.ts when it has props)
- src/lib/               constants, blog markdown loader, waitlist validate/emails
- content/blog/          markdown posts (title/description/pubDate/tags/draft)
- scripts/build-field-guide.mjs  generates public/field-guide.html from docs/standards

## Waitlist
The form POSTs to /api/subscribe, which sends two Resend emails per signup:
a confirmation to the subscriber and a notification to
prompt-janitor@studiotristar.com (the owner tracks signups manually — no
Resend Audience). RESEND_API_KEY must be set as a Vercel environment variable
(studiotristar.com must be a verified Resend sending domain).

## Analytics
GA4 (G-RX37WJZFSQ), production builds only. Events: waitlist_submit{source},
cta_click{href}. Social posts use the UTM convention in
docs/marketing/utm-convention.md.
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
https://promptjanitor.app/blog/what-a-bad-prompt-actually-costs?utm_source=hn&utm_medium=social&utm_campaign=prelaunch

Waitlist `source` values (hero / pricing-free / pricing-pro / footer / blog-<slug>)
arrive in the owner-notification email subject and in GA4's waitlist_submit
event — UTM says where they came FROM, source says which CTA converted.
```

- [ ] **Step 3: Delete the Pages workflow**

```bash
git rm .github/workflows/landing.yml
```

- [ ] **Step 4: Full verification pass**

```bash
cd landing && pnpm test && pnpm build && pnpm start &
sleep 2
for p in / /blog /blog/seven-defects-that-poison-your-agents-context /blog/what-a-bad-prompt-actually-costs /blog/diagnosis-should-be-free /thanks /rss.xml /sitemap.xml /field-guide.html; do
  printf "%s -> %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000$p)"
done   # expect 200 for all
curl -s http://localhost:3000/ | grep -c "G-RX37WJZFSQ"   # expect ≥1
curl -s -X POST localhost:3000/api/subscribe -H 'Content-Type: application/json' -d '{"email":"nope","source":"hero"}'  # expect {"error":"invalid email"}
kill %1
```

Then a manual pass in the browser (desktop + narrow viewport): hero form validation message, FAQ accordion, blog nav round-trip, no horizontal scroll on mobile width.

- [ ] **Step 5: Commit and open the PR**

```bash
git add -A landing docs/marketing .github
git commit -m "docs: marketing site README + UTM convention; retire GH Pages deploy (Vercel)"
git push -u origin feat/prelaunch-site
gh pr create --base main --title "feat(site): pre-launch marketing site — Next.js/Vercel, waitlist, GA4, blog" --body "$(cat <<'EOF'
Implements docs/superpowers/specs/2026-07-16-prelaunch-marketing-site-design.md (rev 2 — Next.js/Vercel).

- Next.js 15 migration of landing/ (visual identity preserved), promptjanitor.app
- Waitlist-first CTAs everywhere; pricing visible ($69 founder, lock-in framing)
- New sections: evidence strip (honest N=5 framing), how-it-works, philosophy
- Blog: 3 launch posts + RSS + sitemap; GA4 G-RX37WJZFSQ with waitlist_submit/cta_click
- /api/subscribe: Resend confirmation + owner notification per signup (no Audience, key server-side)
- GH Pages workflow retired (Vercel deploys); CI landing build-check kept
- Supersedes the landing parts of PR #89 (branch merged in)

Go-live checklist (owner):
- [ ] Import the repo in Vercel, set project Root Directory = landing/
- [ ] Verify studiotristar.com as a Resend sending domain; set RESEND_API_KEY env var in Vercel
- [ ] Add promptjanitor.app as the Vercel domain; update DNS per Vercel's instructions
- [ ] One real end-to-end signup test (confirmation + notification email received)
- [ ] Note: Vercel Hobby tier is nominally non-commercial — revisit Pro ($20/mo) if traction is good

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Post-launch follow-ups (explicitly NOT in this plan)

- Vercel project import, env var, and DNS (owner actions, listed in the PR checklist).
- Closing PR #89 as superseded once this merges.
- Polar checkout wiring, macOS download link, app/fulfillment changes, benchmark powered run (gated on traction — see `docs/BENCHMARK_STATUS.md`).

## Self-Review

- Spec coverage: waitlist-first CTAs w/ visible pricing (T5), GA4-only analytics + UTM (T1/T9), landing+blog scope (T2/T3), Next.js/Vercel stack + API-route waitlist (T1/T4), no-Audience Resend flow w/ owner notification (T4), the 3 approved posts (T6–8), evidence honesty rule (T5/T7), promptjanitor.app metadataBase/RSS/sitemap (T1/T3), thanks kept (T2), field guide kept via generator (T2), Pages workflow retired (T9), out-of-scope list respected. ✓
- Types: `WaitlistFormProps` defined once in T3 and reused in T5/T7 usages; `validateSubscribe`/`buildEmails`/`loadPosts` signatures match between tests and impls; blog `Post`/`PostMeta` consistent across lib, pages, RSS, sitemap; `params` handled as a Promise (Next 15). ✓
- Placeholders: none — every code step shows the code; the two "port lines X–Y" steps reference exact committed line ranges, and the JSX conversion rules are stated once at the top. ✓
```