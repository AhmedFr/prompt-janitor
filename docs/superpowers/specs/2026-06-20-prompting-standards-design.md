# Real Prompting Standards — Design

**Date:** 2026-06-20
**Branch:** `feat/72-real-standards`
**Status:** Approved design, pending implementation plan

## Goal

Distill the current prompting guidance from **Anthropic**, **OpenAI**, and **Cursor**
into two artifacts that share one source of truth:

1. A committed, human-readable standards reference (`docs/standards/prompting-standards.md`).
2. A **first-class built-in catalog of natural-language (NL) standards** that the AI
   evaluates against an instruction file, with violations **folding into the 0–100 score**.

The engine audits *agent instruction files* (`CLAUDE.md`, `AGENTS.md`, `.cursorrules`,
and similar), so every standard is phrased as a checkable property of an instruction
file — not a one-off LLM prompt.

## Context (current architecture)

- **Deterministic built-in rules** live in Rust: `src-tauri/src/rules/*.rs` implement the
  `Rule` trait; `builtin_rules()` lists the 5 current rules (`no-hardcoded-model`,
  `contradiction`, `missing-role`, `missing-few-shot`, `missing-output-format`).
- The **`rules` table** persists toggle state, seeded from `builtin_rules()` via
  `seed_rules()` (idempotent `INSERT OR IGNORE`).
- **Custom rules** (pattern + NL) live in `custom_rules`; NL rows are evaluated by the AI
  provider via `ai_rules::evaluate()` and the `evaluate_nl_rules` Tauri command.
- **NL eval today is on-demand and NOT scored**: `evaluate_nl_rules` returns `NlVerdict`s
  surfaced separately; `run_scan` computes the score from deterministic + custom-pattern
  issues only via `score_for_issues` (PENALTY_HI=15 / MID=7 / LO=3, CAP_MID=30, CAP_LO=15).
- `list_rules` returns a unified `RuleInfo { id, title, description, source, severity,
  enabled, custom, nl, pattern }` list (built-in from Rust + custom from DB).
- `Source` enum: `Anthropic`, `Openai`, `Karpathy`, `Custom`.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Storage | First-class built-in catalog (non-deletable, source-attributed) — not `custom_rules` rows. |
| Scoring | NL violations **fold into the score**. |
| Default state | **Enabled by default** (only fire on the explicit, paid NL action). |
| `Source::Cursor` | **Add** the new enum variant. |
| Catalog size | ~24–26 standards, deduped against the 5 deterministic rules. |

## Components

### A. Notes doc — `docs/standards/prompting-standards.md`

Committed (unlike the gitignored `docs/standards/sources/`). Lists every standard with:
source, severity, the exact NL instruction string, and a one-line rationale. Human-facing
reference; the Rust catalog mirrors it 1:1 by `id`. A test asserts parity (every catalog
id appears in the doc).

### B. Rust catalog — `src-tauri/src/rules/nl_catalog.rs`

```rust
pub struct BuiltinNlRule {
    pub id: &'static str,        // kebab-case, source-prefixed
    pub title: &'static str,     // short human label
    pub instruction: &'static str, // sent to the AI as "Rule: {instruction}"
    pub severity: Severity,      // Hi | Mid | Lo
    pub source: Source,          // Anthropic | Openai | Cursor | Karpathy
}

pub fn builtin_nl_rules() -> Vec<BuiltinNlRule> { /* the catalog below */ }
```

Single-responsibility module, mirroring the `builtin_rules()` pattern. Exported from
`rules/mod.rs`.

### C. Storage & wiring (first-class, non-deletable)

- Add a **`kind` column** to the `rules` table (`TEXT NOT NULL DEFAULT 'deterministic'`);
  catalog rows seed with `kind='nl'`. Migration is additive (existing rows default
  `'deterministic'`).
- `seed_builtin_nl_rules(conn)` seeds the catalog into `rules` (id, source, severity,
  title, description=instruction, kind='nl', enabled=1) idempotently. Called at startup
  right after `seed_rules()`.
- `list_rules`: append `builtin_nl_rules()` as `RuleInfo { custom:false, nl:true,
  pattern:Some(instruction), .. }` with enabled-state read from `rules`.
- `enabled_nl_rules`: **union** the built-in NL catalog (enabled in `rules`) with the
  existing custom NL rows, returning `(id, title, instruction, severity)` for each. The
  existing `evaluate_nl_rules` command then runs both transparently.
- Built-in NL rules are **toggleable but not deletable** (no `custom_rules` row; the
  existing `delete_custom_rule` only touches `custom_rules`).

### D. Score lifecycle (two-phase)

NL eval is async, paid, and triggered separately from the synchronous free scan. We do not
move AI calls into the free path. Instead:

1. **`run_scan` (deterministic, free)** computes the **baseline** score and **clears any
   prior NL-sourced issues** for the file (stale once content changes).
2. **`evaluate_nl_rules` (paid)** persists each violation as an `Issue` tagged NL-sourced
   (by rule id), recomputes the file's score + grade via the unchanged `score_for_issues`,
   and returns the new score alongside the verdicts.

User flow: edit → rescan (baseline, free) → run AI standards (enriches score, paid). Same
formula and grade bands — **no recalibration**.

NL-sourced issues are distinguished in the `issues` table by their rule id prefix (or an
explicit source/kind column if one already exists — to confirm during planning).

## The catalog (~24 standards)

Deduped against deterministic rules: NL standards do **not** re-check role / few-shot /
output-format / hardcoded-model / direct contradiction presence. They are the qualitative
layer.

### Anthropic
| id | sev | instruction |
|---|---|---|
| `anthropic-clarity` | Mid | The file VIOLATES if instructions are vague or ambiguous where a concrete directive is needed (e.g. "be helpful", "handle errors well" with no specifics). |
| `anthropic-examples` | Mid | VIOLATES if non-obvious conventions, formats, or behaviors are described without at least one concrete example. |
| `anthropic-delimit-sections` | Lo | VIOLATES if the file mixes unrelated concerns in one undifferentiated block with no headings, tags, or delimiters separating sections. |
| `anthropic-data-vs-instructions` | Mid | VIOLATES if variable or contextual data is tangled directly into directives instead of being clearly marked as data. |
| `anthropic-allow-idk` | Hi | VIOLATES if the file asks the agent to produce facts, APIs, file paths, or commands but never tells it to admit uncertainty or avoid inventing details. |
| `anthropic-positive-framing` | Lo | VIOLATES if guidance is expressed almost entirely as prohibitions ("don't…") without stating the desired behavior to do instead. |
| `anthropic-context-placement` | Lo | VIOLATES if long reference material or background is placed in the middle of actionable instructions rather than grouped at the end or in its own section. |

### OpenAI
| id | sev | instruction |
|---|---|---|
| `openai-identity` | Mid | VIOLATES if the file never states the agent's purpose, role, or the project it serves. |
| `openai-dos-and-donts` | Mid | VIOLATES if behavioral rules are stated only abstractly without explicit dos and don'ts the agent can follow. |
| `openai-example-consistency` | Lo | VIOLATES if examples in the file use inconsistent formatting or contradict each other. |
| `openai-structure` | Lo | VIOLATES if the file lacks any markdown headers or hierarchy and is hard to scan for distinct topics. |
| `openai-explicitness` | Hi | VIOLATES if the file relies on the agent inferring critical requirements (stack, commands, constraints) that are never stated outright. |
| `openai-context-early` | Lo | VIOLATES if static, reusable context (project facts, conventions) is buried at the end after volatile task detail rather than established up front. |
| `openai-agentic-planning` | Lo | VIOLATES if the file describes multi-step tasks without guiding the agent to plan or decompose before acting. |
| `openai-persistence` | Mid | VIOLATES if the file asks the agent to complete tasks but permits stopping early without finishing or verifying the work. |

### Cursor
| id | sev | instruction |
|---|---|---|
| `cursor-scoped` | Mid | VIOLATES if the file is bloated with rambling or tangential content rather than concise, scoped instructions. |
| `cursor-specific-refs` | Lo | VIOLATES if it points to "the relevant files" or "the config" vaguely instead of naming specific files or paths. |
| `cursor-declare-conventions` | Mid | VIOLATES if the project's stack, build/test commands, or core conventions are never declared. |
| `cursor-one-concern` | Lo | VIOLATES if a single section tries to govern many unrelated concerns that should be split. |
| `cursor-no-stale-blanket` | Lo | VIOLATES if it contains always-apply guidance that is over-broad, outdated, or no longer matches the described project. |
| `cursor-code-style-examples` | Lo | VIOLATES if it mandates a code style without showing a concrete example of compliant code. |

### Karpathy / community
| id | sev | instruction |
|---|---|---|
| `community-success-criteria` | Mid | VIOLATES if tasks are described without any definition of done or success criteria. |
| `community-no-dead-context` | Lo | VIOLATES if it includes reference content that is never connected to any instruction or used by any task. |
| `community-single-source` | Mid | VIOLATES if the same topic is governed by guidance scattered across multiple places that could drift out of sync. |
| `community-concrete-over-abstract` | Lo | VIOLATES if key guidance stays abstract where a concrete rule, value, or example is clearly needed. |

(Exact wording finalized in the notes doc; the table above is the working set.)

## Testing

- `parse_verdict` tests already exist — keep.
- `seed_builtin_nl_rules` idempotency (no duplicate rows on re-seed; toggle state preserved).
- `enabled_nl_rules` returns the union of built-in + custom NL rules, respecting enabled state.
- Catalog ↔ notes-doc parity: every `builtin_nl_rules()` id appears in
  `docs/standards/prompting-standards.md`.
- Score lifecycle: NL violations persist as issues, rescore matches `score_for_issues`,
  and a fresh `run_scan` clears prior NL issues.
- `list_rules` includes built-in NL rules with `custom=false, nl=true` and correct source.

## Out of scope

- No change to deterministic rule logic or grade bands.
- No new crawler sources (existing `scripts/standards-crawler` unchanged).
- No UI redesign beyond the built-in NL rules naturally appearing in the existing rules list.
- Running NL eval inline during the free scan (explicitly rejected).
