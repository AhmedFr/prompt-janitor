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
