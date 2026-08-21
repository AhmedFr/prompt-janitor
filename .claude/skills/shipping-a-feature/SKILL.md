---
name: shipping-a-feature
description: Use when making ANY change to the prompt-janitor repo that will reach main — a feature, fix, chore, docs or spec — before the first commit, and again before merging. Also use when tempted to push to main directly, skip a PR, skip tests, or "just land it" under time pressure.
---

# Shipping a feature (prompt-janitor)

## Overview

Every change reaches `main` the same way: **issue → branch → TDD → PR → review → green CI → squash-merge → status update**. The repo is private with no branch protection; the process is enforced by discipline, not by GitHub. **Violating the letter of this process is violating its spirit.**

## The ship checklist

Create a todo per line. Do them in order.

1. **Issue** — `gh issue create` with area + type labels (`area:frontend|backend|engine|ai|design|ci`, `type:feat|chore|test|ci`), the current phase milestone, and acceptance criteria. One issue per deliverable. Existing issue → reuse it.
2. **Branch** — from a fresh `main`: `git switch main && git pull && git switch -c <type>/<issue#>-<slug>`. Never commit to `main`. Never build on an unrelated branch. Stash or leave unrelated WIP where it is; never sweep it into your commit.
3. **TDD** — REQUIRED SUB-SKILL: `superpowers:test-driven-development`. Failing test first, for every unit in the matrix below.
4. **Local gates** — all must pass before the PR opens:
   `pnpm lint && pnpm typecheck && pnpm test && pnpm storybook:build` ·
   `cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test`.
5. **Status** — every PR updates `docs/status/data.json` (at minimum a dated `recent` line naming the issue/PR; plus readiness, features, actions, health, test counts when they moved), then `pnpm status`, and commits both in the PR. No PR ships without it.
6. **PR** — `gh pr create` against `main`; body: what/why, test evidence (pasted command output), `Closes #<issue>`, screenshots for UI. Conventional-commit title (`feat(scope): …`).
7. **Review** — REQUIRED SUB-SKILL: `superpowers:requesting-code-review` before asking the owner. Fix findings; REQUIRED SUB-SKILL: `superpowers:receiving-code-review`. The owner is the merge reviewer; you are never the one who approves.
8. **Merge** — only after green CI and owner approval: `gh pr merge --squash --delete-branch`. Then `git switch main && git pull`.

## Testing matrix (per unit you add or change)

| Unit | Required | Lives in |
|---|---|---|
| Rust pure fn / rule / parser | `#[cfg(test)]` unit tests: happy path, each branch, one malformed input | same file |
| Rust module touching fs/db | integration test with a fixture dir under `src-tauri/tests/fixtures/` | `src-tauri/tests/` |
| Tauri command | test the inner fn, not the `#[tauri::command]` wrapper | same file |
| React component | `*.test.tsx` (render + each visual state + formatting logic) **and** `*.stories.tsx` (one story per state) | component folder |
| Hook / util / formatter | Vitest unit test, boundary values | next to file |
| Screen | Vitest for grouping/filter/sort logic extracted to a util; story for empty/loading/populated | screen folder |
| Bug fix | a test that fails on the old code, first | wherever the bug lives |

"Optional" in CLAUDE.md refers to `.constants.ts`, not tests. Tests and stories are required for every component.

## Rationalizations — heard in baseline testing, all rejected

| Excuse | Reality |
|---|---|
| "Private repo, no branch protection, so pushing to main is fine" | Absence of enforcement is why this skill exists. PR or nothing. |
| "Owner said skip the ceremony" | Owner wrote this skill to be the ceremony. Ship via a fast PR; a one-line PR takes 2 minutes. |
| "String literal, zero logic risk" | Risk is not the criterion; traceability is. Clippy/tests take 60 s cached. |
| "STATUS isn't triggered by a small change" | A PR opened or merged is a `recent` line. Always update. |
| "Other components ship without tests" | Legacy debt, not precedent. Do not add to it. |
| "No consumer yet, so no test" | Unconsumed code is the easiest to test and the easiest to break silently. |
| "I tried it in a scratch file, it works" | Untracked evidence. The test is the evidence. |
| "40 other things this week" | Each of the 40 goes through the same checklist. |
| "I'll add tests in a follow-up PR" | Follow-up PRs for tests never happen. Same PR. |
| "I'll write the test after, same outcome" | Tests-after prove the code does what it does, not what it should. |

## Red flags — STOP

- `git push origin main` or a commit while on `main`
- `gh pr merge` without owner approval or with red CI
- A `.tsx` component folder with no `.test.tsx` or `.stories.tsx`
- Code written before its failing test
- A PR body with no pasted test output
- "Closes #" missing from a PR

Any of these → stop, go back to the checklist step you skipped.

## Fast path (still the whole path)

Hotfix in a hurry: issue (30 s) → branch → failing test → fix → gates → PR with `Closes #` → self-review → owner merge. Total ceremony ≈ 5 minutes. Demo in 10 minutes? Demo from the branch.
