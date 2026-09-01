# Prompt Janitor

A macOS desktop app that finds, grades, and helps you fix the AI prompt files scattered across your projects — `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, and friends.

It detects your Claude Code setup automatically — no folder picker to configure. On a schedule, it inventories your global and per-project rules, skills, agents, commands, hooks, MCP servers, and plugins, and indexes your Claude Code session logs so you can see which of them are actually used (a manual "extra folder" in Settings remains available for anything outside that automatic scope). Each rule file is graded **A–F** against best-practice standards (Anthropic, OpenAI, Karpathy/community, plus your own rules), with issues surfaced via a cited source and a plain-English explanation, notifications on a calm cadence, and — as a paid upgrade — automatic rewrites for the bad parts.

## Screens

Every inventory list in the app is the same sortable, searchable, pill-filtered table (`DataTable`, TanStack Table underneath); tables and inventory tabs remember their search, filters, sort and active tab per session.

- **Overview** — the 10-second verdict: is your setup good enough, and what to fix first.
- **Setup** — the inventory, one tab per artifact kind: Rules · Skills · Agents · Commands · Hooks · MCP · Plugins · Settings, across global and every project, with usage evidence (uses, sessions, last used, error rate, average context tokens), scope/plugin provenance, and never-used / errors / high-cost filters.
- **Projects** — every scanned project with grade, open issues, sessions, never-used artifacts and folder-missing status; each opens a **project page** with Rules (graded files), Effective rules (load order global → project), Setup (the project's own artifacts) and Usage (top tools + sessions per day).
- **Prompts** — a flat table of every graded file with project chip, kind, grade, issues and modified date.
- **Analytics** — health trends and a Usage tab of ranked bars (top used by kind, most errors, most expensive) over a 7/30/90-day window.
- **Rules** — Built-in · Custom · AI standards tabs with enable switches, hit counts and actions; **Add rule** opens a separate two-step flow (pattern rule or natural-language standard).
- **Settings** — harnesses, extra folders, AI provider, notifications, schedule.
- **Menu bar** — left-click the tray icon for a floating panel: verdict and delta, top-3 files to fix, never-used skills / erroring MCP servers / sessions today, Scan now, Open app, Quit. Closing the main window keeps the app running in the menu bar (Dock icon hidden until you open it again); right-click keeps the classic menu.

## Status

🚧 Early development. The full design and phased roadmap live in
[`docs/superpowers/specs/2026-06-04-prompt-janitor-design.md`](docs/superpowers/specs/2026-06-04-prompt-janitor-design.md).

## Stack

- **Runtime:** [Tauri](https://tauri.app) — React + TypeScript frontend, Rust core
- **Engine:** deterministic local rules grade for free; AI (local SLM or BYO key) powers the paid auto-fix
- **Store:** SQLite
- **Package manager:** pnpm

## Pricing model

**Monetisation paused (2026-08):** all features are currently open; the tiers below describe the intended offer.

**Diagnosis free. Treatment paid.**

- **Free forever:** scanning, scheduling, and grading — including the built-in
  natural-language standards catalog, evaluated on your own compute (local Ollama
  or BYO API key). Unlimited scans, every finding shown.
- **Pro (one-time purchase):** AI auto-fix & rewrites, custom natural-language
  rules, starter template packs, the Prompt-File Field Guide, and 12 months of
  feature updates (optional renewal afterwards — never required to keep using
  the app).

Full offer design: [`docs/superpowers/specs/2026-07-02-lifetime-offer-design.md`](docs/superpowers/specs/2026-07-02-lifetime-offer-design.md).

### Minting license keys (vendor only)

Licenses are Ed25519-signed payloads verified offline against the public key embedded in
`src-tauri/src/license.rs`. The vendor keypair and customer keys are produced with the
`license-tool` binary:

```sh
cd src-tauri
cargo run -p license-tool -- keygen                 # once: writes pj-vendor-key.secret,
                                                       # prints the PUBKEY array for license.rs
cargo run -p license-tool -- mint --key pj-vendor-key.secret --email buyer@example.com
cargo run --bin license-tool -- verify "PJ1.…"         # sanity-check against the embedded key
```

Store the private key in a password manager and delete the file — `*.secret` is gitignored,
and the key can never be recovered or rotated transparently for existing customers.

## Updating & uninstalling

Updates arrive in the app. Once a release is published, Prompt Janitor checks for a
newer build shortly after launch and shows a line above the screen area; **Settings →
App** has the same check on a button, with the release notes, a download bar, and
"Install & relaunch". Downloads are verified against the signing key baked into the
build before anything is installed. Until the first release is tagged there is nothing
to serve, and the tab says so rather than reporting an error.

To remove the app:

- **From inside the app** — Settings → App → *Uninstall Prompt Janitor…* removes the
  local data and moves the bundle to the Trash. *Reset app data…* next to it wipes the
  database and backups but keeps the app, running on a fresh, empty database.
- **By hand** — drag `Prompt Janitor.app` to the Trash and delete its data:

  ```sh
  rm -rf ~/Library/Application\ Support/com.promptjanitor.app
  ```

Neither route touches the prompt files it scanned: Prompt Janitor reads those where they
live and only ever writes its findings into its own app-data directory.

## Development

This project ships via GitHub milestones (one per phase), one issue per deliverable,
a branch + PR per issue, and CI gating merges to `main`. See the spec's
"GitHub ship process" section for conventions.
