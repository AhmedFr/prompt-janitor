#!/usr/bin/env bash
# THE merge gate. GitHub Actions CI is deactivated (manual dispatch only), so
# this is what every branch must pass before push or merge.
#
#   pnpm check         full suite (what CI used to run)
#   pnpm check:fast    skips the Storybook, landing and fulfillment builds
#                      (the pre-push hook)
#
# Bypass the hook for an emergency push with: SKIP_CHECKS=1 git push
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
cd "$root"

fast=0
[[ "${1:-}" == "--fast" ]] && fast=1

step() {
  printf '\n\033[1;34m▶ %s\033[0m\n' "$*"
  "$@"
}
in_dir() { local d="$1"; shift; printf '\n\033[1;34m▶ [%s] %s\033[0m\n' "$d" "$*"; (cd "$root/$d" && "$@"); }

# Frontend
step pnpm lint
step pnpm test
step pnpm build:vite
(( fast )) || step pnpm storybook:build

# Rust
in_dir src-tauri cargo fmt --check
in_dir src-tauri cargo clippy --all-targets -- -D warnings
in_dir src-tauri cargo test

# Fulfillment worker
in_dir fulfillment pnpm typecheck
in_dir fulfillment pnpm test

# Landing
(( fast )) || in_dir landing pnpm build

printf '\n\033[1;32m✔ all gates passed\033[0m\n'
