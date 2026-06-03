# Prompt Janitor

A macOS desktop app that finds, grades, and helps you fix the AI prompt files scattered across your projects — `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, and friends.

It scans your folders on a schedule, grades each prompt file **A–F** against best-practice standards (Anthropic, OpenAI, Karpathy/community, plus your own rules), surfaces issues with a cited source and a plain-English explanation, notifies you on a calm cadence, and — as a paid upgrade — rewrites the bad parts for you.

## Status

🚧 Early development. The full design and phased roadmap live in
[`docs/superpowers/specs/2026-06-04-prompt-janitor-design.md`](docs/superpowers/specs/2026-06-04-prompt-janitor-design.md).

## Stack

- **Runtime:** [Tauri](https://tauri.app) — React + TypeScript frontend, Rust core
- **Engine:** deterministic local rules grade for free; AI (local SLM or BYO key) powers the paid auto-fix
- **Store:** SQLite
- **Package manager:** pnpm

## Pricing model

Scanning & grading are **free forever**. A one-time purchase unlocks **AI auto-fix & rewrites**.

## Development

This project ships via GitHub milestones (one per phase), one issue per deliverable,
a branch + PR per issue, and CI gating merges to `main`. See the spec's
"GitHub ship process" section for conventions.
