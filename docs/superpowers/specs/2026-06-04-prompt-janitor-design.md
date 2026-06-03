# Prompt Janitor — Design & Roadmap Spec

- **Date:** 2026-06-04
- **Status:** Approved (design), ready for implementation planning
- **Owner:** Ahmed ABOUELLEIL
- **Source design:** Claude Design handoff bundle (`Prompt Janitor App.html` + imports), chat transcript `chats/chat1.md`

---

## 1. Vision

**Prompt Janitor** is a macOS desktop app that lives on your machine and gives you visibility over the AI prompt files scattered across your projects — `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, and friends. It scans your folders on a schedule, **grades** each file A–F (0–100) against best-practice standards (Anthropic, OpenAI, Karpathy/community, plus your own rules), surfaces issues with a cited source and a plain-English explanation, notifies you on a calm cadence, and — as a paid upgrade — rewrites the bad parts for you.

The product fills a real gap: today there is no central place to see whether your prompts are good, going stale, or drifting from your standards.

## 2. Locked decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Runtime | **Tauri** (React/TS frontend + Rust core) | Fits the user's pnpm/React/TS world; Rust gives a fast, safe, `.gitignore`-aware scanner; tiny signed binary; native tray/menu-bar. |
| 2 | Grading engine | **Hybrid** — deterministic local rules for free grading; AI only for paid fixes | Offline, private, deterministic, zero-cost grading; matches the "grade free / fix paid" pricing. |
| 3 | AI provider | **Pluggable: Local SLM (default) OR BYO cloud key** | Local SLM keeps it private & free to run; BYO key (Anthropic/OpenAI) for higher-quality rewrites. |
| 4 | Sequencing | **Vertical slice first** | De-risk the scan→grade→display core end-to-end before widening. |
| 5 | Phase-1 scope | **Scan → grade → Overview + Prompts list + Detail** (read-only, real data) | Smallest path that proves the whole engine. |
| 6 | Custom rules | **Patterns free; natural-language rules AI-evaluated** | Keeps free-tier grading deterministic; NL rules ride the paid AI layer. |
| 7 | Fix safety | **Write to disk + local backup/undo + optionally stage/commit on a git branch** | Reviewable, reversible edits to real source files. |

## 3. Architecture

```
┌─────────────────────────── Tauri window ───────────────────────────┐
│  React + TypeScript (Vite, pnpm)                                    │
│   Sidebar · Overview · Prompts · Detail · Scans · Rules · Settings  │
│   + overlays: Onboarding wizard, Menu-bar popover                   │
└───────────────▲───────────────────────────────────────────────────┘
        invoke() │ commands          events │ scan-progress, scan-done
┌───────────────┴───────────────────────────────────────────────────┐
│  Rust core                                                         │
│   Scanner (ignore + globset)   Engine (rules → score)              │
│   Store (SQLite)   Scheduler (tokio + notify)   Tray/notifications │
│   AI/Fix engine (LocalSlm | CloudKey | None)   Git (git2)          │
└────────────────────────────────────────────────────────────────────┘
```

- **Frontend:** React + TypeScript, Vite, pnpm. State via React Query over Tauri `invoke`. Cupertino design tokens ported from `tokens.css`.
- **Backend:** Rust, organized by responsibility: `scanner/`, `engine/`, `store/`, `ai/`, `scheduler/`, `tray/`, `git/`.
- **Typed IPC:** `tauri-specta` generates TypeScript types from Rust commands/structs — one source of truth shared by the frontend's `.types.ts` files.
- **Events:** backend emits `scan-progress` and `scan-done`; frontend subscribes for live progress (onboarding first-scan bar, "Scan now").

## 4. Data model (SQLite)

| Table | Key fields |
|---|---|
| `projects` | id, name, root_path, grade, score |
| `files` | id, project_id, path, type (CLAUDE.md/AGENTS.md/…), score, grade, issue_count, modified_at |
| `scans` | id, started_at, finished_at, files_scanned, net_health_delta, improved, regressed |
| `issues` | id, file_id, line, severity (hi/mid/lo), source (anthropic/openai/karpathy/custom), title, why, fix_from, fix_to, dismissed_at |
| `grade_history` | id, scope (file/overall), scope_id, score, recorded_at |
| `rules` | id, source, severity, title, desc, enabled |
| `custom_rules` | id, kind (pattern/nl), expr, severity, title, enabled |
| `settings` | key/value: folders, ignore rules, schedule, alert prefs, ai_provider config, launch-at-login, menu-bar grade |
| `backups` | id, file_id, pre_fix_content, applied_at, git_ref |

## 5. Grading & scoring

- **Inputs:** the set of enabled rules (built-in packs + custom). Each rule is a detector that, run over a file, yields zero or more **issues** `{line?, severity, source, title, why, fix?}`.
- **Score:** file starts at 100; each issue subtracts a weighted penalty (critical ≫ warning ≫ nit), with per-severity caps so a long file full of nits cannot collapse to F on nits alone. Penalty weights and letter bands are **configuration**, calibrated against the design's seed data:
  - Seed calibration targets: 94→A, 91→A, 86→B, 81→B, 78→B, 68→C, 52→D, 38→F.
  - Working bands (tunable): **A ≥ 90 · B 80–89 · C 65–79 · D 50–64 · F < 50**.
- **Overall health:** aggregate across files (weighted by issue severity counts) → its own A–F + 0–100.
- **Trend:** `grade_history` powers sparklines and "+8 this week" deltas.
- **Free vs paid line:** all *scoring/grading* is free and deterministic. All *rewriting* (auto-fix, AI suggestions, NL custom rules) is paid.

## 6. Prompt-file detection & scanning

- **Default glob set (user-extensible):** `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.cursor/rules/*.mdc`, `.windsurfrules`, `.clinerules`, `.github/copilot-instructions.md`, `GEMINI.md`, `.aider*`, `.continuerules`.
- **Walking:** ripgrep's `ignore` crate — respects `.gitignore`, skips `node_modules`/vendor, optional symlink-follow. All three toggles already exist in Settings → Folders.
- **Per file:** read content, run enabled detectors, compute score/grade, persist issues + history, emit progress.

## 7. AI / fix engine (paid layer)

- **Provider trait** with three implementations:
  - **LocalSlm** — default; detect a running **Ollama** instance (fallback: BYO key). No model bundled into the binary (keeps download small).
  - **CloudKey** — BYO Anthropic/OpenAI key, configured + "Test connection" in Settings.
  - **None** — free tier; fix actions are visible but gated.
- **Apply fix:** write to disk → snapshot prior content into `backups` (in-app undo) → **optionally** stage/commit on a `prompt-janitor/fix-*` git branch (via `git2`) so changes are reviewable. "Auto-fix N" batches the file's fixable issues.
- **NL custom rules:** evaluated by the configured provider; disabled when provider is `None`.
- **Entitlement:** offline **license key** unlocks the paid tier (no backend to run).

## 8. Feature behaviour by screen

> These define expected behaviour, resolving the prototype's mock-only interactions.

- **Overview (Dashboard):** overall health grade + score, health-trend sparkline with week delta, severity counts (critical/warning/nit), and a prioritized **worklist** sorted by Critical-first / By project / Newest. Rows open Detail at the offending file/line. "Scan now" triggers a real scan.
- **Prompts (list):** sortable table of every detected file (grouped by grade by default), filter chips (All / Flagged / by file-type), search. Rows open Detail.
- **Detail:** left = annotated source with problem spans highlighted by line and severity colour; right = score ring (with "was B · −22 this week") + issue list. Selecting an issue highlights its line and reveals the *why* + suggested-fix diff. **Apply fix / Auto-fix N** are gated to the paid tier (visible, disabled, with upsell, until Phase 4).
- **Scans (digest):** weekly summary card (net health, files improved, regressed) + sparkline; "Needs your eyes" list (regressions, never-graded files, improvements); next-digest time; "Review the week".
- **Rules & standards:** plain-English composer (pattern builder free; NL rules gated) with severity selector; active-rule cards toggleable on/off (affects grading immediately), filterable by source pack; Import pack.
- **Settings:** tabs — **Folders** (add/remove scanned folders, ignore rules), **Schedule** (1h / 6h / 1d / on-save / manual), **Alerts** (weekly digest, regression alerts, per-issue alerts, sound), **Rules** (link to Rules screen), **General** (launch at login, show grade in menu bar, anonymous stats).
- **Onboarding wizard:** Folders → Rules (pick source packs) → Schedule → animated first scan → land on Overview. Replayable.
- **Menu-bar popover:** status snapshot (overall grade, health bar, files/needs-attention counts), top-3 to fix, "Scan now" + "Open dashboard". Optional grade glyph in the menu bar.

## 9. Phased roadmap

Each phase is a **GitHub milestone**; each deliverable below becomes one or more **issues**.

### Phase 0 — Scaffold
Tauri + React + TS + pnpm scaffold; port design tokens to a tokens module; build the shared component library (`Grade`, `Src` badge, `Sev`, `Sparkline`, `ScoreRing`, cards, buttons) per the folder convention; SQLite plugin + migrations; `tauri-specta` typed IPC; app shell (sidebar, routing, macOS window chrome). CI green.
**Acceptance:** app boots to an empty shell; component library renders in Storybook; `pnpm lint && pnpm test && cargo test` pass in CI.

### Phase 1 — Vertical slice ⭐
Real folder scan → deterministic rules v1 (the mock's checks: hard-coded model name, contradictory instructions, missing role/persona, no few-shot, unspecified output format — plus a few more) → score/grade → persist → **Overview + Prompts table + Detail** on real data. Annotated source, score ring, why panel, suggested-fix diff shown (Apply disabled). Manual "Scan now". TDD on scanner + every rule.
**Acceptance:** point the app at a real folder, scan it, and see accurate grades/issues across Overview, Prompts, and Detail backed by SQLite.

### Phase 2 — Scheduler, history & menu-bar
Background scheduler (1h/6h/1d/manual) + watch-mode (on-save); real grade history → sparklines/trends/deltas; tray icon + menu-bar popover; native weekly-digest + regression notifications; Scans digest screen; full Onboarding wizard.
**Acceptance:** scans run unattended on schedule; trends reflect history; menu-bar popover and notifications work; onboarding completes into a populated app.

### Phase 3 — Rules & standards
Built-in rule packs (Anthropic/OpenAI/Karpathy/community) shipped as data, toggleable + filterable by source; Rules screen; pattern-based custom rules (free); Import pack; Settings fully wired (Folders/Schedule/Alerts/Rules/General).
**Acceptance:** toggling rules/packs changes grades; custom pattern rules detect issues; all settings persist and take effect.

### Phase 4 — AI fix engine (paid)
Provider config + "Test connection" in Settings; AI rewrites; Apply/Auto-fix with backup + undo + optional git commit/branch; NL custom rules (AI-evaluated); offline license-key entitlement gate.
**Acceptance:** with a provider configured + license active, Apply fix edits the file safely (backup/undo, optional git branch); NL rules evaluate; free tier stays gated.

### Phase 5 — Ship & polish
macOS sign/notarize, auto-update, DMG; accessibility/performance/animation passes; build the landing marketing page (separate static site, already designed).
**Acceptance:** signed, notarized, auto-updating DMG; a11y/perf audits pass; landing page deployed.

## 10. Repo structure & conventions

```
prompt-janitor/
├─ package.json (pnpm)            # workspace root
├─ src/                           # React/TS frontend
│  ├─ components/<Name>/          # index.ts, <Name>.tsx, <Name>.types.ts,
│  │                              # [<Name>.constants.ts], <Name>.test.tsx, <Name>.stories.tsx
│  ├─ screens/<Name>/             # same per-folder convention
│  ├─ lib/ (ipc, query, tokens)
│  └─ App/
├─ src-tauri/                     # Rust core
│  └─ src/{scanner,engine,store,ai,scheduler,tray,git}/
├─ docs/superpowers/specs/        # this spec
└─ .github/                       # CI, issue/PR templates
```
Conventions (from global CLAUDE.md): **pnpm**; one folder per component; single responsibility per file; split logic vs layout; avoid very long files.

## 11. GitHub ship process

- **Milestones:** one per phase (Phase 0–5).
- **Labels:** `phase:0`…`phase:5`, `area:frontend`, `area:backend`, `area:engine`, `area:ai`, `type:feat`, `type:chore`, `type:test`, `type:ci`.
- **Issues:** one per deliverable, on its phase milestone, with area + type labels and acceptance criteria.
- **Branches:** `feat/<issue#>-<slug>`, `chore/…`, `ci/…` off `main`.
- **PRs:** one per issue, `Closes #<issue>`, requires green CI before merge; squash-merge to `main`.
- **CI (GitHub Actions):** on PR/push — `pnpm install`, `pnpm lint`, `pnpm test`, `pnpm -C src-tauri? cargo fmt --check`, `cargo clippy`, `cargo test`, and a Tauri build smoke check.

## 12. Out of scope (YAGNI for now)

- Windows/Linux builds (macOS-first; architecture stays portable).
- Cloud sync / team features / accounts.
- A hosted backend (entitlement is an offline license key).
- Bundling a local model into the binary (rely on Ollama if present).

## 13. Open details to refine during implementation

- Exact penalty weights & letter-band cutoffs (calibrate against real corpora beyond the seed data).
- Local-SLM model choice and Ollama UX (detect / prompt to install).
- License-key format & validation.
- Whether watch-mode "on save" debounces per file or per project.
