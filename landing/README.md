# Prompt Janitor — landing page

A self-contained static marketing site (Vite, no framework). It is **not** part
of the app's pnpm workspace — install and build it on its own:

```bash
cd landing
pnpm install --ignore-workspace
pnpm dev      # local preview at http://localhost:5173
pnpm build    # static output → landing/dist
```

## Screenshots

The hero shows a faithful CSS mockup of the app's Overview. To use a real
screenshot instead, drop a PNG into `public/` and swap the `.hero__art` block in
`index.html` for an `<img>`.

## Deploy

`.github/workflows/landing.yml` builds `landing/` and publishes `landing/dist`
to GitHub Pages on pushes to `main`. Pages must be enabled for the repository
(Settings → Pages → Source: GitHub Actions), which requires a public repo or a
plan that includes Pages. The build is relative-pathed (`base: "./"`), so it also
works under a custom domain or any host that serves a static folder.
