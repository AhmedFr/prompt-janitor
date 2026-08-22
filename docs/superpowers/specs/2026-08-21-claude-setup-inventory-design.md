# Claude Setup Inventory + Usage Analytics — design

**Date:** 2026-08-21
**Status:** approved in brainstorm, awaiting owner review of this document
**Supersedes:** folder-picker scan scope from `2026-06-04-prompt-janitor-design.md`

## 1. Why

The owner feels the pain the product targets and still does not open it. Diagnosis
from the brainstorm:

1. Findings are not acted on because they are generic — they do not know how the
   agent harness actually loads files (global + project + skills merge), they show
   no consequence, and there is no before/after diff to apply.
2. There is no "one-shot cleanup" moment; notifications without trust are noise.
3. Folder selection is friction for something that should simply scan the user's
   whole agent setup.
4. There are no golden rules for agent instructions, so the only advice that does
   not feel flimsy is advice grounded in the user's **own usage evidence**.

That evidence exists locally. Claude Code keeps everything under `~/.claude`:
global rules, settings (hooks, permissions, MCP), skills, agents, commands,
plugins, and a JSONL log per session under `~/.claude/projects/<slug>/` that
records every `tool_use` / `tool_result` (skills, subagents, MCP calls, builtins)
with timestamps and token usage. On the owner's machine: 32 projects, 177 MB of
logs, ~40 skills.

## 2. Product direction (roadmap)

Monetisation is out of scope for now; all Pro gates are removed. The goal is a
tool the owner uses daily.

| Phase | Deliverable | Notes |
|---|---|---|
| 0 | Unblock | OpenRouter LLM provider behind an `LlmProvider` trait; remove Pro gates |
| **1** | **Setup inventory + usage analytics** | **this spec** |
| 2 | Evidence-backed findings + before/after diff apply | rules cite usage data; one-click per-file apply; LLM-assisted rewrites via OpenRouter |
| 3 | Menu-bar notifications | existing tray shows "3 stale skills, 1 rule conflict" → opens cleanup |
| 4 | Personal agent (RAG over setup + logs) | parked until 1–2 prove the evidence is worth conversing with |

Each phase gets its own spec/plan; phases 2–4 are listed only so phase 1's data
model serves them.

## 3. Scope of phase 1

### 3.1 Scan scope is automatic

The folder picker and `scan_roots` are removed from onboarding. Scan scope is
defined by each detected harness. For Claude Code:

| Layer | Source | Inventory |
|---|---|---|
| Global | `~/.claude/CLAUDE.md` | rule file (graded by the existing engine) |
| Global | `~/.claude/settings.json`, `settings.local.json` | hooks, permissions, MCP servers, env |
| Global | `~/.claude/skills/*/SKILL.md`, `agents/*.md`, `commands/*.md` | skills, agents, commands |
| Global | `~/.claude/plugins/installed_plugins.json`, `plugins/cache/**` | plugins → their bundled skills/agents/MCP |
| Global | `~/.claude.json` (sibling of `~/.claude`) | globally-installed MCP servers (`mcpServers`) |
| Project | each dir decoded from `~/.claude/projects/<slug>` that still exists | `CLAUDE.md`, `AGENTS.md`, `.claude/{settings*.json,skills,agents,commands}`, `.mcp.json`, plus existing `.cursorrules` / copilot discovery |
| Project | `~/.claude.json` → `projects.<abs path>.mcpServers` | MCP servers added for that project without `--scope project` |
| Usage | `~/.claude/projects/<slug>/*.jsonl` | every tool invocation, incrementally |
| Usage | `~/.claude/projects/<slug>/<session>/subagents/agent-*.jsonl` | sub-agent transcripts, indexed as child sessions |

A manual "extra folder" remains available in Settings as an escape hatch.

Slug decoding: `-Users-ahmedabouelleil-code-02-personal-aprocy` → `/Users/ahmedabouelleil/code/02-personal/aprocy`.
Slugs are lossy — `-` may be a path separator, a literal dash, or a `.` (both
`/` and `.` are encoded as `-`, so `~/.claude/worktrees/wt` becomes
`--claude-worktrees-wt`). The slug directory is the project's identity, but
`cwd` is the primary slug→path disambiguator: each session log embeds `cwd`,
and `cwd` (or one of its ancestors, since `cwd` may be a subdirectory the
session was started in, or the parent repo of a git worktree) is checked first
for whether it re-encodes to this slug. Only when no session's `cwd` resolves
the slug does the harness fall back to walking path components and preferring
the longest existing prefix. Projects whose path no longer exists are kept with
`exists = false` (their usage history still counts) but are not scanned for
files.

### 3.2 Usage depth: counts + outcomes (option B)

Per-invocation rows are stored, not just counts, so later findings can state
consequences ("this MCP errors 30% of the time", "Skill X turns cost 2× average").

## 4. Architecture

### 4.1 Harness plugin abstraction

Two provider axes exist and both use a trait + registry pattern so new members
are added as modules without touching consumers.

**Axis 1 — agent harnesses** (this spec): Claude Code first; Cursor, Codex CLI,
Copilot, Gemini CLI later.

```
src-tauri/src/harness/
  mod.rs          -- trait Harness + registry (Vec<Box<dyn Harness>>)
  model.rs        -- harness-neutral types: Artifact, ArtifactKind, ProjectRef,
                     Session, Invocation, UsageCursor
  claude_code/
    mod.rs        -- impl Harness for ClaudeCode
    inventory.rs  -- ~/.claude + project .claude discovery
    logs.rs       -- jsonl tailing, tool_use/tool_result pairing, classification
    plugins.rs    -- installed_plugins.json + cache parsing
    slug.rs       -- project slug ↔ path
```

```rust
pub trait Harness: Send + Sync {
    fn id(&self) -> &'static str;                          // "claude_code"
    fn display_name(&self) -> &'static str;
    fn detect(&self) -> bool;                              // installed for this user?
    fn projects(&self) -> Vec<ProjectRef>;                 // harness-defined scan scope
    fn inventory(&self, scope: Scope) -> Vec<Artifact>;    // Scope::Global | Scope::Project(slug)
    fn index_usage(&self, cursor: &mut UsageCursor) -> UsageBatch;       // incremental; empty for harnesses without logs
}
```

`ArtifactKind` is a closed, shared enum:
`Rule | Skill | Agent | Command | Hook | McpServer | Plugin | Settings`.
A harness maps its vocabulary onto it (Cursor "rules" → `Rule`, Copilot
"prompts" → `Command`). Screens, IPC commands and findings rules depend only on
`harness::model`; they never import `claude_code::`.

The scanner orchestrates: for each detected harness → `projects()` →
`inventory()` per scope → `index_usage()` → store. The existing file grading
engine runs unchanged on every `Rule` artifact (global `CLAUDE.md` is now graded
too).

**Axis 2 — LLM providers** (phase 0, same pattern): `trait LlmProvider { async fn complete(system, user) -> Result<String> }`
with `ai/anthropic.rs`, `ai/openai.rs`, `ai/openrouter.rs` and a registry keyed
by the `ai_provider` setting. OpenRouter is OpenAI-compatible
(`https://openrouter.ai/api/v1/chat/completions`, plus `HTTP-Referer`/`X-Title`
headers).

### 4.2 Log indexer (Claude Code)

- One `Session` per `.jsonl` file; id = file stem (uuid); `project_slug` = parent dir.
- Tail by byte offset stored in `sessions.byte_offset`; a re-run on unchanged
  files reads zero bytes. A file that shrinks (rotated/deleted) resets to 0.
- Records are newline-delimited JSON; parse each line independently, skip
  unparsable or unknown `type` values — never fatal.
- Pair `tool_use` (by `id`) with its `tool_result` (`tool_use_id`); derive
  `duration_ms` from timestamps, `is_error` from the result's `is_error` flag,
  `turn_tokens` from the assistant message `usage` block when present.
- Classification of `tool_name`:
  - `Skill` → kind `skill`, target = `input.skill`
  - `Agent` → kind `agent`, target = `input.subagent_type` (default `general-purpose`)
  - `mcp__<server>__<tool>` → kind `mcp`, target = `<server>`
  - anything else → kind `builtin`, target = tool name
- Hooks never appear as tool calls; they are inventory-only.
- First full index of ~177 MB must finish in seconds, not minutes: stream lines,
  no full-file reads, batch inserts in one transaction per file.

### 4.3 Data model (SQLite, additive migration)

```
harnesses        id PK ('claude_code'), detected, last_scan_at

harness_projects (harness, path) PK, exists, log_dir, last_session_at,
                 session_count

artifacts        id PK, harness, layer ('global'|'project'|'plugin'), project_path?,
                 kind, name, path, plugin_name?, description, bytes, hash, seen_at,
                 file_id?  -- link to existing graded `files` row for Rule kinds

sessions         id PK, harness, project_path, log_path, started_at, ended_at, turns,
                 input_tokens, output_tokens, model, byte_offset

invocations      id PK, harness, session_id, tool_use_id, project_path, ts,
                 tool_name, kind, target, artifact_id?, duration_ms, is_error,
                 turn_tokens

usage_stats      materialised after each index run:
                 artifact_id, total, sessions, last_used, error_rate,
                 avg_turn_tokens, count_30d, count_prev_30d
```

`invocations.target` joins to `artifacts.name` (within harness, preferring the
project layer then global then plugin) to populate `artifact_id`; unmatched
targets (e.g. an uninstalled plugin's MCP) stay unlinked but still count in
analytics. Artifacts with no invocations are flagged *never used*.

Size estimate: ~2,300 invocations per large session × hundreds of sessions ≈
low hundreds of thousands of rows. Indexes on `(artifact_id, ts)`,
`(session_id)`, `(harness, project_path, ts)`.

### 4.4 IPC

New commands (in `commands.rs`, thin over `query.rs`):
`list_harnesses`, `get_setup(scope)` (artifacts + usage for global or a project),
`list_projects`, `get_effective_rules(project_slug)` (global + project rule files
in load order), `usage_timeseries(kind|artifact, range)`, `scan_now` (unchanged
entry point, now harness-driven).

## 5. UI

**Onboarding:** "Detected: Claude Code — 1 global setup, 32 projects, 177 MB of
session history" → *Scan everything*. Progress for the first index only.

**Sidebar:** Overview · **Setup** (new) · Prompts · Analytics · Rules · Scans · Settings.

- **Setup** — the dedicated view.
  - **Global** section: global rule grade; one card per skill / agent / command /
    hook / MCP server / plugin with a usage badge
    (`used 42× · 12 sessions · last 3d ago`, or muted *never used*).
  - **Projects** section: sorted by recent activity; each expands to its rule
    files (grades), project-level skills/agents/MCP, and the **effective rule
    set** (global + project, in load order — what Claude actually reads there).
  - Filter chips: *never used* · *errors* · *high cost*.
  - Grouped by harness only when more than one harness is detected.
- **Analytics** gains a *Usage* tab: top skills/agents/MCPs over time, error rate
  per MCP server, tokens per turn by tool kind, sessions per project. Recharts,
  existing token theming.
- **Detail** (rule file): shows its position in the merge (global vs project)
  and usage of artifacts it references by name.
- **Settings:** harness list (detected / not), manual extra folder, LLM provider
  incl. OpenRouter key.

Component convention (user CLAUDE.md): one folder per component with
`index.ts`, component, `.types.ts`, optional `.constants.ts`, test, story.

## 6. Error handling

- Missing `~/.claude` → harness `detect()` false; app shows "no supported agent
  harness found" with the manual folder fallback.
- Unreadable/corrupt log lines are skipped and counted in scan diagnostics
  (the `scan_diagnostics` table), surfaced in the Scans screen.
- Log format drift (undocumented): classification falls back to `builtin`;
  unknown record types are ignored. A fixture test pins the currently observed
  shape so drift fails CI loudly.
- Slug → path ambiguity resolved by longest existing prefix; unresolved slugs
  are stored with `exists = false`.

## 7. Testing

- Fixture tree `src-tauri/tests/fixtures/claude_home/` with global files, two
  projects, one plugin, and a small anonymised real-shaped `.jsonl`.
- Rust unit tests: inventory discovery per layer; plugin parsing; slug decoding
  (incl. dash-in-name ambiguity); tool_use/result pairing; classification of all
  four kinds; incremental tailing (second run yields zero rows, shrink resets);
  usage_stats rollup; effective-rules ordering.
- Vitest: Setup screen grouping/filter logic, usage badge formatting.
- `cargo fmt`, `clippy -D warnings`, `cargo test` per CI.

## 8. Open decisions

1. **Vercel AI SDK vs Rust for the personal agent (phase 4).** All LLM calls live
   in Rust today. Using the Vercel SDK means either LLM calls from the webview
   (keys in the frontend) or a Node sidecar. Decision: keep AI in Rust through
   phase 2; revisit when phase 4 is specced, only if streaming/tool-calling
   ergonomics justify a sidecar.
2. **Log retention.** Invocations are kept indefinitely for now; add a retention
   setting if DB size becomes a problem.

## 9. Out of scope (phase 1)

Findings that use usage data, diff/apply, notifications, other harnesses,
monetisation, RAG/agent.
