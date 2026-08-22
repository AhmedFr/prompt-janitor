# Prompt Janitor — project instructions

## Live status dashboard (mandatory)

`STATUS.html` at the repo root is the owner's single source of truth for project state.
It is generated — never edit it by hand.

After ANY change that affects project state — a feature lands, a PR opens or merges, an
issue opens or closes, a blocker appears or clears, test counts change, a human action
item is completed or discovered — you MUST, in the same session:

1. Update `docs/status/data.json` (readiness %, phases, features, actions, health,
   backlog, and append a dated line to `recent`).
2. Run `pnpm status` to regenerate `STATUS.html`.
3. Commit both files together with the change (or in the PR that caused it).

The `actions` section lists things ONLY the human owner can do (testing on a real Mac,
PR review, external accounts/credentials, pricing & vision decisions). Keep it honest:
remove items the owner has done, add new ones as they appear, and keep "blocking"
ordered as a step-by-step ship checklist.

## Conventions

- Ship process: one issue per deliverable, branch + PR per issue, milestones = phases.
- Version bumps: `pnpm bump <semver>` (syncs package.json, tauri.conf.json, Cargo.toml, Cargo.lock).
- Rust: `cargo fmt`, `clippy --all-targets -- -D warnings`, and `cargo test` must pass (CI enforces).
- License vendor flow: see README "Minting license keys".
- Harness modules: screens, IPC commands and rules import `crate::harness::model` only — never `crate::harness::claude_code::*`.
- Status dashboard: every PR updates `docs/status/data.json` + `pnpm status`.
