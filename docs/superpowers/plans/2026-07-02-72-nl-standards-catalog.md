# NL Standards Catalog + Provider-Gated Eval (#72) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the built-in catalog of 25 natural-language prompting standards (Anthropic/OpenAI/Cursor/community), evaluated by the user's AI provider **without a license** (offer-spec §5 amendment), with violations folding into the 0–100 score.

**Architecture:** A static Rust catalog (`nl_catalog.rs`) mirrors a committed notes doc 1:1 (parity-tested). Catalog rows seed into the existing `rules` table (`kind='nl'`, toggleable, non-deletable). `evaluate_nl_rules` evaluates built-ins for anyone with a provider, plus custom NL rules for licensed users, persists violations as `rule_id`-tagged issues, and rescores the file with the unchanged formula.

**Tech Stack:** Rust (rusqlite, tauri, tauri-specta), React + TypeScript (Vite), pnpm.

**Specs:** `docs/superpowers/specs/2026-06-20-prompting-standards-design.md` as amended by `docs/superpowers/specs/2026-07-02-lifetime-offer-design.md` §5 (see comment on issue #72).

## Global Constraints

- Package manager: **pnpm** only.
- Branch: `feat/72-real-standards` (already checked out). One PR, `Closes #72`.
- CI must stay green: `pnpm lint && pnpm test` at root; `cargo fmt --check && cargo clippy && cargo test` in `src-tauri/`.
- **No scoring recalibration:** `PENALTY_HI=15, PENALTY_MID=7, PENALTY_LO=3, CAP_MID=30, CAP_LO=15`; bands A ≥ 90 · B 80–89 · C 65–79 · D 50–64 · F < 50.
- **Gate amendment:** built-in NL catalog eval requires only a configured provider (no license). **Custom** NL rules remain license-gated. `PAID_GATE` stays untouched for rewrites/fixes.
- Catalog: exactly **25 standards** (7 Anthropic, 8 OpenAI, 6 Cursor, 4 community), enabled by default, toggleable, non-deletable.
- `cargo test` regenerates `src/lib/bindings.ts` (a test in `ipc.rs` does this — commit the regenerated file whenever Rust types change).
- Frontend files follow the folder convention (component folder with `index.ts`, `.tsx`, `.types.ts`, optional `.constants.ts`).
- Rust tests use `Connection::open_in_memory()` + `crate::store::migrate(&conn)` (see `query.rs` tests ~line 727).
- All `git commit` messages end with `Co-Authored-By:` trailer per repo convention (see `git log`).

---

### Task 1: Migration — `rules.kind` + `issues.rule_id`

**Files:**
- Modify: `src-tauri/src/store.rs` (append to `const MIGRATIONS: &[&str]`, ends ~line 93)
- Test: `src-tauri/src/store.rs` (tests module at bottom)

**Interfaces:**
- Produces: `rules.kind TEXT NOT NULL DEFAULT 'deterministic'` and `issues.rule_id TEXT` (NULL for deterministic issues), used by Tasks 5–7.

- [ ] **Step 1: Write the failing test** (in `store.rs` `#[cfg(test)] mod tests`, next to the existing migration tests)

```rust
    #[test]
    fn migration_2_adds_kind_and_rule_id() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        // rules.kind exists and defaults to 'deterministic'
        conn.execute(
            "INSERT INTO rules(id, source, severity, title) VALUES('x', 'anthropic', 'hi', 'X')",
            [],
        )
        .unwrap();
        let kind: String = conn
            .query_row("SELECT kind FROM rules WHERE id = 'x'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(kind, "deterministic");
        // issues.rule_id exists and is nullable
        conn.execute(
            "INSERT INTO issues(file_id, severity, source, title, why) VALUES('f', 'hi', 'custom', 'T', 'W')",
            [],
        )
        .unwrap();
        let rule_id: Option<String> = conn
            .query_row("SELECT rule_id FROM issues LIMIT 1", [], |r| r.get(0))
            .unwrap();
        assert_eq!(rule_id, None);
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test migration_2_adds_kind_and_rule_id`
Expected: FAIL with `no such column: kind`

- [ ] **Step 3: Append the migration** — in `store.rs`, add a second element to `MIGRATIONS` (after the closing `",` of the first migration string, before `];`):

```rust
    // 2: rules.kind (deterministic|nl) + issues.rule_id (tags NL-sourced issues).
    "
    ALTER TABLE rules ADD COLUMN kind TEXT NOT NULL DEFAULT 'deterministic';
    ALTER TABLE issues ADD COLUMN rule_id TEXT;
    ",
```

- [ ] **Step 4: Run the store tests**

Run: `cd src-tauri && cargo test store::`
Expected: PASS — including the pre-existing version-count tests (they assert against `MIGRATIONS.len()` so they adapt automatically).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/store.rs
git commit -m "feat(store): migration 2 — rules.kind + issues.rule_id"
```

---

### Task 2: `Source::Cursor` everywhere a source is named

**Files:**
- Modify: `src-tauri/src/engine.rs` (enum ~line 23, `as_str` ~line 53)
- Modify: `src-tauri/src/query.rs` (`source_from_db`, line 49)
- Modify: `src/components/SourceBadge/SourceBadge.types.ts`
- Modify: `src/components/SourceBadge/SourceBadge.constants.ts`
- Modify: `src/components/SourceBadge/SourceBadge.css`

**Interfaces:**
- Produces: `Source::Cursor` with string form `"cursor"`, consumed by the catalog (Task 3) and issue persistence (Task 7); `SourceId` union gains `"cursor"`.

- [ ] **Step 1: Write the failing test** (in `engine.rs` tests, or create a small tests block if none covers `Source`)

```rust
    #[test]
    fn cursor_source_roundtrips() {
        assert_eq!(Source::Cursor.as_str(), "cursor");
    }
```

And in `query.rs` tests:

```rust
    #[test]
    fn source_from_db_parses_cursor() {
        assert_eq!(source_from_db("cursor"), Source::Cursor);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src-tauri && cargo test cursor_source`
Expected: FAIL to compile — `no variant named Cursor`

- [ ] **Step 3: Implement.** `engine.rs` — add the variant and its string form:

```rust
pub enum Source {
    Anthropic,
    Openai,
    Cursor,
    Karpathy,
    Custom,
}
```

```rust
            Source::Cursor => "cursor",
```

`query.rs::source_from_db` — add the arm:

```rust
        "cursor" => Source::Cursor,
```

`SourceBadge.types.ts`:

```ts
export type SourceId = "anthropic" | "openai" | "cursor" | "karpathy" | "custom";
```

`SourceBadge.constants.ts` (insert after `openai`):

```ts
  cursor: { label: "Cursor", className: "src--cursor" },
```

`SourceBadge.css` (after the `.src--openai` block, matching its shape — copy the `.src--person` block's structure with a distinct tint, e.g. the existing purple/violet token used elsewhere in `tokens`):

```css
.src--cursor {
  background: color-mix(in srgb, var(--text) 8%, transparent);
  color: var(--text);
}
```

(If `color-mix`/`--text` don't match this stylesheet's idiom, mirror exactly whatever `.src--person` does with a different color token — the requirement is only: a distinct, theme-consistent badge.)

- [ ] **Step 4: Run tests**

Run: `cd src-tauri && cargo test && cd .. && pnpm test`
Expected: PASS (Rust `match` exhaustiveness will surface any missed `Source` match — fix any compile errors by adding the `Cursor` arm the same way the sibling arms work).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/engine.rs src-tauri/src/query.rs src/components/SourceBadge/ src/lib/bindings.ts
git commit -m "feat(engine): Source::Cursor variant + badge"
```

---

### Task 3: The catalog — `rules/nl_catalog.rs`

**Files:**
- Create: `src-tauri/src/rules/nl_catalog.rs`
- Modify: `src-tauri/src/rules/mod.rs` (declare + re-export)

**Interfaces:**
- Produces: `pub struct BuiltinNlRule { pub id: &'static str, pub title: &'static str, pub instruction: &'static str, pub severity: Severity, pub source: Source }` and `pub fn builtin_nl_rules() -> Vec<BuiltinNlRule>` — consumed by Tasks 4, 5, 6, and `list_rules`.

- [ ] **Step 1: Write the failing tests** (bottom of the new `nl_catalog.rs`)

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::Source;

    #[test]
    fn catalog_has_25_unique_standards() {
        let rules = builtin_nl_rules();
        assert_eq!(rules.len(), 25);
        let mut ids: Vec<_> = rules.iter().map(|r| r.id).collect();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), 25, "duplicate ids");
        assert!(rules.iter().all(|r| !r.instruction.is_empty()));
    }

    #[test]
    fn catalog_source_distribution_matches_spec() {
        let rules = builtin_nl_rules();
        let count = |s: Source| rules.iter().filter(|r| r.source == s).count();
        assert_eq!(count(Source::Anthropic), 7);
        assert_eq!(count(Source::Openai), 8);
        assert_eq!(count(Source::Cursor), 6);
        assert_eq!(count(Source::Karpathy), 4);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src-tauri && cargo test nl_catalog`
Expected: FAIL to compile — module doesn't exist yet (add `mod nl_catalog;` first so failure is about the missing items).

- [ ] **Step 3: Implement the catalog.** Full content of `src-tauri/src/rules/nl_catalog.rs`:

```rust
//! Built-in natural-language standards catalog (#72).
//!
//! Each entry is a checkable property of an *instruction file*, evaluated by
//! the configured AI provider ("Rule: {instruction}"). Mirrors
//! `docs/standards/prompting-standards.md` 1:1 by id (parity-tested).

use crate::engine::{Severity, Source};

/// One built-in NL standard. Non-deletable; toggle state lives in `rules`.
pub struct BuiltinNlRule {
    pub id: &'static str,
    pub title: &'static str,
    pub instruction: &'static str,
    pub severity: Severity,
    pub source: Source,
}

/// The full catalog, in display order (source-grouped).
pub fn builtin_nl_rules() -> Vec<BuiltinNlRule> {
    use Severity::{Hi, Lo, Mid};
    use Source::{Anthropic, Cursor, Karpathy, Openai};
    vec![
        // ── Anthropic ────────────────────────────────────────────────
        BuiltinNlRule { id: "anthropic-clarity", title: "Vague directives", severity: Mid, source: Anthropic,
            instruction: "The file VIOLATES if instructions are vague or ambiguous where a concrete directive is needed (e.g. \"be helpful\", \"handle errors well\" with no specifics)." },
        BuiltinNlRule { id: "anthropic-examples", title: "Missing examples", severity: Mid, source: Anthropic,
            instruction: "VIOLATES if non-obvious conventions, formats, or behaviors are described without at least one concrete example." },
        BuiltinNlRule { id: "anthropic-delimit-sections", title: "Undelimited sections", severity: Lo, source: Anthropic,
            instruction: "VIOLATES if the file mixes unrelated concerns in one undifferentiated block with no headings, tags, or delimiters separating sections." },
        BuiltinNlRule { id: "anthropic-data-vs-instructions", title: "Data tangled into instructions", severity: Mid, source: Anthropic,
            instruction: "VIOLATES if variable or contextual data is tangled directly into directives instead of being clearly marked as data." },
        BuiltinNlRule { id: "anthropic-allow-idk", title: "Never allows uncertainty", severity: Hi, source: Anthropic,
            instruction: "VIOLATES if the file asks the agent to produce facts, APIs, file paths, or commands but never tells it to admit uncertainty or avoid inventing details." },
        BuiltinNlRule { id: "anthropic-positive-framing", title: "Prohibitions only", severity: Lo, source: Anthropic,
            instruction: "VIOLATES if guidance is expressed almost entirely as prohibitions (\"don't…\") without stating the desired behavior to do instead." },
        BuiltinNlRule { id: "anthropic-context-placement", title: "Reference buried mid-instructions", severity: Lo, source: Anthropic,
            instruction: "VIOLATES if long reference material or background is placed in the middle of actionable instructions rather than grouped at the end or in its own section." },
        // ── OpenAI ───────────────────────────────────────────────────
        BuiltinNlRule { id: "openai-identity", title: "No agent identity", severity: Mid, source: Openai,
            instruction: "VIOLATES if the file never states the agent's purpose, role, or the project it serves." },
        BuiltinNlRule { id: "openai-dos-and-donts", title: "No explicit dos & don'ts", severity: Mid, source: Openai,
            instruction: "VIOLATES if behavioral rules are stated only abstractly without explicit dos and don'ts the agent can follow." },
        BuiltinNlRule { id: "openai-example-consistency", title: "Inconsistent examples", severity: Lo, source: Openai,
            instruction: "VIOLATES if examples in the file use inconsistent formatting or contradict each other." },
        BuiltinNlRule { id: "openai-structure", title: "No headers or hierarchy", severity: Lo, source: Openai,
            instruction: "VIOLATES if the file lacks any markdown headers or hierarchy and is hard to scan for distinct topics." },
        BuiltinNlRule { id: "openai-explicitness", title: "Critical requirements implied", severity: Hi, source: Openai,
            instruction: "VIOLATES if the file relies on the agent inferring critical requirements (stack, commands, constraints) that are never stated outright." },
        BuiltinNlRule { id: "openai-context-early", title: "Stable context buried", severity: Lo, source: Openai,
            instruction: "VIOLATES if static, reusable context (project facts, conventions) is buried at the end after volatile task detail rather than established up front." },
        BuiltinNlRule { id: "openai-agentic-planning", title: "No planning guidance", severity: Lo, source: Openai,
            instruction: "VIOLATES if the file describes multi-step tasks without guiding the agent to plan or decompose before acting." },
        BuiltinNlRule { id: "openai-persistence", title: "Allows stopping early", severity: Mid, source: Openai,
            instruction: "VIOLATES if the file asks the agent to complete tasks but permits stopping early without finishing or verifying the work." },
        // ── Cursor ───────────────────────────────────────────────────
        BuiltinNlRule { id: "cursor-scoped", title: "Bloated, unscoped content", severity: Mid, source: Cursor,
            instruction: "VIOLATES if the file is bloated with rambling or tangential content rather than concise, scoped instructions." },
        BuiltinNlRule { id: "cursor-specific-refs", title: "Vague file references", severity: Lo, source: Cursor,
            instruction: "VIOLATES if it points to \"the relevant files\" or \"the config\" vaguely instead of naming specific files or paths." },
        BuiltinNlRule { id: "cursor-declare-conventions", title: "Stack & commands undeclared", severity: Mid, source: Cursor,
            instruction: "VIOLATES if the project's stack, build/test commands, or core conventions are never declared." },
        BuiltinNlRule { id: "cursor-one-concern", title: "Sections mix concerns", severity: Lo, source: Cursor,
            instruction: "VIOLATES if a single section tries to govern many unrelated concerns that should be split." },
        BuiltinNlRule { id: "cursor-no-stale-blanket", title: "Stale blanket guidance", severity: Lo, source: Cursor,
            instruction: "VIOLATES if it contains always-apply guidance that is over-broad, outdated, or no longer matches the described project." },
        BuiltinNlRule { id: "cursor-code-style-examples", title: "Style without example", severity: Lo, source: Cursor,
            instruction: "VIOLATES if it mandates a code style without showing a concrete example of compliant code." },
        // ── Karpathy / community ─────────────────────────────────────
        BuiltinNlRule { id: "community-success-criteria", title: "No definition of done", severity: Mid, source: Karpathy,
            instruction: "VIOLATES if tasks are described without any definition of done or success criteria." },
        BuiltinNlRule { id: "community-no-dead-context", title: "Dead reference content", severity: Lo, source: Karpathy,
            instruction: "VIOLATES if it includes reference content that is never connected to any instruction or used by any task." },
        BuiltinNlRule { id: "community-single-source", title: "Scattered duplicate guidance", severity: Mid, source: Karpathy,
            instruction: "VIOLATES if the same topic is governed by guidance scattered across multiple places that could drift out of sync." },
        BuiltinNlRule { id: "community-concrete-over-abstract", title: "Abstract where concrete needed", severity: Lo, source: Karpathy,
            instruction: "VIOLATES if key guidance stays abstract where a concrete rule, value, or example is clearly needed." },
    ]
}
```

In `rules/mod.rs`, after the existing `mod` lines and re-exports:

```rust
mod nl_catalog;

pub use nl_catalog::{builtin_nl_rules, BuiltinNlRule};
```

- [ ] **Step 4: Run tests**

Run: `cd src-tauri && cargo test nl_catalog`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/rules/
git commit -m "feat(rules): built-in NL standards catalog (25 standards)"
```

---

### Task 4: Notes doc + parity test

**Files:**
- Create: `docs/standards/prompting-standards.md`
- Test: `src-tauri/src/rules/nl_catalog.rs` (append test)

**Interfaces:**
- Consumes: `builtin_nl_rules()` from Task 3.
- Produces: the committed human-readable reference (also the source for the Field Guide, #76).

- [ ] **Step 1: Write the failing parity test** (inside `nl_catalog.rs`'s tests module)

```rust
    #[test]
    fn every_catalog_id_appears_in_the_notes_doc() {
        let doc = include_str!("../../../docs/standards/prompting-standards.md");
        for rule in builtin_nl_rules() {
            assert!(
                doc.contains(&format!("`{}`", rule.id)),
                "{} missing from docs/standards/prompting-standards.md",
                rule.id
            );
            assert!(
                doc.contains(rule.instruction),
                "{}'s instruction drifted from the notes doc",
                rule.id
            );
        }
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test every_catalog_id`
Expected: FAIL — `include_str!` can't find the file (compile error).

- [ ] **Step 3: Write the doc.** `docs/standards/prompting-standards.md` — one row per catalog entry; **instruction strings copied verbatim from Task 3** (the parity test enforces exactness — note the doc must contain the *unescaped* text, so `\"` in Rust is a plain `"` here):

```markdown
# Prompting Standards — the built-in NL catalog

Distilled from the current prompting guidance of **Anthropic**, **OpenAI**, and
**Cursor**, plus community practice. This doc and
`src-tauri/src/rules/nl_catalog.rs` share one source of truth: every catalog id
appears here with its exact instruction string (enforced by a parity test).

Each standard is a checkable property of an *agent instruction file*
(`CLAUDE.md`, `AGENTS.md`, `.cursorrules`, …), phrased so an AI evaluator can
answer "does this file VIOLATE the rule?".

Severity: **Hi** = critical · **Mid** = warning · **Lo** = nit.

## Anthropic

| Id | Sev | Instruction | Why it matters |
|---|---|---|---|
| `anthropic-clarity` | Mid | The file VIOLATES if instructions are vague or ambiguous where a concrete directive is needed (e.g. "be helpful", "handle errors well" with no specifics). | Vague asks produce vague behavior; models follow specifics. |
| `anthropic-examples` | Mid | VIOLATES if non-obvious conventions, formats, or behaviors are described without at least one concrete example. | One example beats three sentences of description. |
| `anthropic-delimit-sections` | Lo | VIOLATES if the file mixes unrelated concerns in one undifferentiated block with no headings, tags, or delimiters separating sections. | Structure tells the model what belongs together. |
| `anthropic-data-vs-instructions` | Mid | VIOLATES if variable or contextual data is tangled directly into directives instead of being clearly marked as data. | Unmarked data gets treated as instruction, and vice versa. |
| `anthropic-allow-idk` | Hi | VIOLATES if the file asks the agent to produce facts, APIs, file paths, or commands but never tells it to admit uncertainty or avoid inventing details. | The #1 defense against hallucinated paths and APIs. |
| `anthropic-positive-framing` | Lo | VIOLATES if guidance is expressed almost entirely as prohibitions ("don't…") without stating the desired behavior to do instead. | Models steer better toward stated targets than away from bans. |
| `anthropic-context-placement` | Lo | VIOLATES if long reference material or background is placed in the middle of actionable instructions rather than grouped at the end or in its own section. | Mid-stream reference dilutes the directives around it. |

## OpenAI

| Id | Sev | Instruction | Why it matters |
|---|---|---|---|
| `openai-identity` | Mid | VIOLATES if the file never states the agent's purpose, role, or the project it serves. | Identity anchors every downstream decision. |
| `openai-dos-and-donts` | Mid | VIOLATES if behavioral rules are stated only abstractly without explicit dos and don'ts the agent can follow. | Abstract values don't constrain concrete actions. |
| `openai-example-consistency` | Lo | VIOLATES if examples in the file use inconsistent formatting or contradict each other. | Contradictory examples train contradictory behavior. |
| `openai-structure` | Lo | VIOLATES if the file lacks any markdown headers or hierarchy and is hard to scan for distinct topics. | Both humans and models navigate by structure. |
| `openai-explicitness` | Hi | VIOLATES if the file relies on the agent inferring critical requirements (stack, commands, constraints) that are never stated outright. | What isn't stated will be guessed — sometimes wrong. |
| `openai-context-early` | Lo | VIOLATES if static, reusable context (project facts, conventions) is buried at the end after volatile task detail rather than established up front. | Stable facts up front frame everything after them. |
| `openai-agentic-planning` | Lo | VIOLATES if the file describes multi-step tasks without guiding the agent to plan or decompose before acting. | Unplanned multi-step work drifts and stalls. |
| `openai-persistence` | Mid | VIOLATES if the file asks the agent to complete tasks but permits stopping early without finishing or verifying the work. | Agents stop at the first plausible answer unless told not to. |

## Cursor

| Id | Sev | Instruction | Why it matters |
|---|---|---|---|
| `cursor-scoped` | Mid | VIOLATES if the file is bloated with rambling or tangential content rather than concise, scoped instructions. | Every wasted token crowds out code context. |
| `cursor-specific-refs` | Lo | VIOLATES if it points to "the relevant files" or "the config" vaguely instead of naming specific files or paths. | Named paths are actionable; "the config" is a guess. |
| `cursor-declare-conventions` | Mid | VIOLATES if the project's stack, build/test commands, or core conventions are never declared. | The first thing an agent needs is how to build and test. |
| `cursor-one-concern` | Lo | VIOLATES if a single section tries to govern many unrelated concerns that should be split. | Mixed sections are half-read and half-applied. |
| `cursor-no-stale-blanket` | Lo | VIOLATES if it contains always-apply guidance that is over-broad, outdated, or no longer matches the described project. | Stale blanket rules teach the agent to distrust the file. |
| `cursor-code-style-examples` | Lo | VIOLATES if it mandates a code style without showing a concrete example of compliant code. | Style is imitated from examples, not adjectives. |

## Karpathy / community

| Id | Sev | Instruction | Why it matters |
|---|---|---|---|
| `community-success-criteria` | Mid | VIOLATES if tasks are described without any definition of done or success criteria. | Without "done", agents under- or over-shoot. |
| `community-no-dead-context` | Lo | VIOLATES if it includes reference content that is never connected to any instruction or used by any task. | Dead context costs tokens and buys nothing. |
| `community-single-source` | Mid | VIOLATES if the same topic is governed by guidance scattered across multiple places that could drift out of sync. | Duplicated guidance always eventually contradicts itself. |
| `community-concrete-over-abstract` | Lo | VIOLATES if key guidance stays abstract where a concrete rule, value, or example is clearly needed. | Concrete rules are checkable; abstractions are vibes. |
```

- [ ] **Step 4: Run the parity test**

Run: `cd src-tauri && cargo test every_catalog_id`
Expected: PASS. If an instruction assertion fails, fix the *doc* to match the Rust string exactly (unescaping `\"` → `"`).

- [ ] **Step 5: Commit**

```bash
git add docs/standards/prompting-standards.md src-tauri/src/rules/nl_catalog.rs
git commit -m "docs(standards): committed prompting-standards reference + parity test"
```

---

### Task 5: Seed the catalog into `rules`

**Files:**
- Modify: `src-tauri/src/query.rs` (new fn next to `seed_rules`, line 485)
- Modify: `src-tauri/src/lib.rs` (line 48, after `seed_rules`)

**Interfaces:**
- Consumes: `builtin_nl_rules()` (Task 3), `rules.kind` (Task 1).
- Produces: `pub fn seed_builtin_nl_rules(conn: &Connection) -> rusqlite::Result<()>` — rows `kind='nl'`, `description` = instruction, `enabled=1`.

- [ ] **Step 1: Write the failing tests** (in `query.rs` tests)

```rust
    #[test]
    fn nl_seed_is_idempotent_and_preserves_toggles() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        seed_builtin_nl_rules(&conn).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM rules WHERE kind = 'nl'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 25);

        set_rule(&conn, "anthropic-clarity", false).unwrap();
        seed_builtin_nl_rules(&conn).unwrap(); // re-seed must not resurrect or duplicate
        let count_again: i64 = conn
            .query_row("SELECT COUNT(*) FROM rules WHERE kind = 'nl'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count_again, 25);
        let enabled: i64 = conn
            .query_row(
                "SELECT enabled FROM rules WHERE id = 'anthropic-clarity'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(enabled, 0);
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test nl_seed_is_idempotent`
Expected: FAIL to compile — `seed_builtin_nl_rules` not found.

- [ ] **Step 3: Implement** — in `query.rs`, directly below `seed_rules`:

```rust
/// Seed the built-in NL standards catalog. Idempotent — preserves toggles.
pub fn seed_builtin_nl_rules(conn: &Connection) -> rusqlite::Result<()> {
    for rule in crate::rules::builtin_nl_rules() {
        conn.execute(
            "INSERT OR IGNORE INTO rules(id, source, severity, title, description, enabled, kind)
             VALUES(?1, ?2, ?3, ?4, ?5, 1, 'nl')",
            params![
                rule.id,
                rule.source.as_str(),
                rule.severity.as_str(),
                rule.title,
                rule.instruction,
            ],
        )?;
    }
    Ok(())
}
```

In `lib.rs`, after `query::seed_rules(&conn).ok();` (line 48):

```rust
            query::seed_builtin_nl_rules(&conn).ok();
```

- [ ] **Step 4: Run tests**

Run: `cd src-tauri && cargo test nl_seed`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/query.rs src-tauri/src/lib.rs
git commit -m "feat(store): seed built-in NL catalog into rules (kind='nl')"
```

---

### Task 6: `enabled_nl_rules` union (entitlement-aware) + `list_rules` shows the catalog

**Files:**
- Modify: `src-tauri/src/query.rs` (`enabled_nl_rules` line 616, `list_rules` line 503)

**Interfaces:**
- Produces: `pub struct NlRuleRow { pub id: String, pub title: String, pub instruction: String, pub severity: String, pub source: String }` and `pub fn enabled_nl_rules(conn: &Connection, include_custom: bool) -> rusqlite::Result<Vec<NlRuleRow>>`. Built-ins always included (when enabled); custom rows only when `include_custom` (licensed). `list_rules` appends catalog entries as `RuleInfo { custom: false, nl: true, pattern: Some(instruction) }`.

- [ ] **Step 1: Write the failing tests** (in `query.rs` tests)

```rust
    #[test]
    fn enabled_nl_rules_unions_catalog_and_custom_by_entitlement() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        seed_builtin_nl_rules(&conn).unwrap();
        add_nl_rule(&conn, "No Slack", "VIOLATES if it mentions Slack.", "mid").unwrap();
        set_rule(&conn, "anthropic-clarity", false).unwrap();

        let free = enabled_nl_rules(&conn, false).unwrap();
        assert_eq!(free.len(), 24, "24 enabled built-ins, no custom");
        assert!(free.iter().all(|r| !r.id.starts_with("custom-nl-")));
        assert!(!free.iter().any(|r| r.id == "anthropic-clarity"));
        assert!(free.iter().any(|r| r.source == "cursor"));

        let paid = enabled_nl_rules(&conn, true).unwrap();
        assert_eq!(paid.len(), 25, "24 built-ins + 1 custom");
        assert!(paid.iter().any(|r| r.id.starts_with("custom-nl-") && r.source == "custom"));
    }

    #[test]
    fn list_rules_includes_the_nl_catalog() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        seed_builtin_nl_rules(&conn).unwrap();
        let rules = list_rules(&conn).unwrap();
        let clarity = rules
            .iter()
            .find(|r| r.id == "anthropic-clarity")
            .expect("catalog rule listed");
        assert!(clarity.nl);
        assert!(!clarity.custom);
        assert!(clarity.pattern.as_deref().unwrap_or("").starts_with("The file VIOLATES"));
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src-tauri && cargo test enabled_nl_rules_unions`
Expected: FAIL to compile — wrong arity / `NlRuleRow` missing.

- [ ] **Step 3: Implement.** Replace `enabled_nl_rules` (query.rs:615–634) with:

```rust
/// A natural-language rule ready to evaluate.
pub struct NlRuleRow {
    pub id: String,
    pub title: String,
    pub instruction: String,
    pub severity: String,
    pub source: String,
}

/// Enabled NL rules: the built-in catalog (free — provider-gated only), plus
/// the user's custom NL rules when `include_custom` (licensed).
pub fn enabled_nl_rules(
    conn: &Connection,
    include_custom: bool,
) -> rusqlite::Result<Vec<NlRuleRow>> {
    let mut enabled = std::collections::HashMap::new();
    {
        let mut stmt = conn.prepare("SELECT id, enabled FROM rules WHERE kind = 'nl'")?;
        let rows = stmt.query_map([], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)? != 0))
        })?;
        for row in rows {
            let (id, on) = row?;
            enabled.insert(id, on);
        }
    }
    let mut out: Vec<NlRuleRow> = crate::rules::builtin_nl_rules()
        .into_iter()
        .filter(|r| enabled.get(r.id).copied().unwrap_or(true))
        .map(|r| NlRuleRow {
            id: r.id.to_string(),
            title: r.title.to_string(),
            instruction: r.instruction.to_string(),
            severity: r.severity.as_str().to_string(),
            source: r.source.as_str().to_string(),
        })
        .collect();

    if include_custom {
        let mut stmt = conn.prepare(
            "SELECT id, title, expr, severity FROM custom_rules
             WHERE kind = 'nl' AND enabled = 1 ORDER BY id",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok(NlRuleRow {
                id: r.get(0)?,
                title: r.get(1)?,
                instruction: r.get(2)?,
                severity: r.get(3)?,
                source: "custom".to_string(),
            })
        })?;
        for row in rows {
            out.push(row?);
        }
    }
    Ok(out)
}
```

In `list_rules` (query.rs:503), after the deterministic built-ins are collected into `out` (line 528) and **before** the `custom_rules` query, append:

```rust
    for rule in crate::rules::builtin_nl_rules() {
        out.push(RuleInfo {
            id: rule.id.to_string(),
            title: rule.title.to_string(),
            description: rule.instruction.to_string(),
            source: rule.source,
            severity: rule.severity,
            enabled: enabled.get(rule.id).copied().unwrap_or(true),
            custom: false,
            nl: true,
            pattern: Some(rule.instruction.to_string()),
        });
    }
```

(The `enabled` map at the top of `list_rules` already reads *all* of `rules`, so no query change is needed.)

- [ ] **Step 4: Run tests** — the compiler will flag the old 1-arg call in `commands.rs:235`; patch it minimally for now (`enabled_nl_rules(&conn, entitlement_of(&conn).paid)` — Task 8 rewrites this properly) and fix the tuple destructuring to use `NlRuleRow` fields.

Run: `cd src-tauri && cargo test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/query.rs src-tauri/src/commands.rs
git commit -m "feat(rules): entitlement-aware NL rule union + catalog in list_rules"
```

---

### Task 7: Persist NL verdicts as issues + rescore

**Files:**
- Modify: `src-tauri/src/engine.rs` (`score_for_issues`, line 133)
- Modify: `src-tauri/src/ai_rules.rs` (`NlVerdict`, line 11)
- Modify: `src-tauri/src/query.rs` (new fn `apply_nl_verdicts`)

**Interfaces:**
- Consumes: `issues.rule_id` (Task 1), `grade_for_score` (existing in engine).
- Produces: `NlVerdict` gains `pub source: String`; `pub fn score_for_counts(hi: u32, mid: u32, lo: u32) -> u32` in engine; `pub fn apply_nl_verdicts(conn: &Connection, file_id: &str, verdicts: &[crate::ai_rules::NlVerdict]) -> rusqlite::Result<(u32, String)>` returning `(new_score, grade_letter)`.

- [ ] **Step 1: Refactor scoring seam (no behavior change).** In `engine.rs`, extract the arithmetic of `score_for_issues` into:

```rust
/// Roll severity counts up into a 0–100 score (same math as `score_for_issues`).
pub fn score_for_counts(hi: u32, mid: u32, lo: u32) -> u32 {
    let mid_pen = (mid * PENALTY_MID).min(CAP_MID);
    let lo_pen = (lo * PENALTY_LO).min(CAP_LO);
    100u32.saturating_sub(hi * PENALTY_HI + mid_pen + lo_pen)
}
```

and make `score_for_issues` count severities then delegate to `score_for_counts`. **Copy the exact penalty/cap expressions from the current body** — if the existing code differs from the above (e.g. different cap application order), keep the existing behavior and adjust `score_for_counts` to match it.

Run: `cd src-tauri && cargo test engine`
Expected: PASS — the focal-fixture test (`53`, grade D) proves the refactor changed nothing.

- [ ] **Step 2: Add `source` to `NlVerdict`** (ai_rules.rs:11):

```rust
pub struct NlVerdict {
    pub rule_id: String,
    pub title: String,
    pub severity: String,
    pub source: String,
    pub violates: bool,
    pub explanation: String,
}
```

(Compiler flags the construction site in `commands.rs:258` — add `source: severity_source_placeholder` no: populate from the `NlRuleRow.source` field, which is already in scope from Task 6's minimal patch.)

- [ ] **Step 3: Write the failing test for `apply_nl_verdicts`** (query.rs tests)

```rust
    #[test]
    fn nl_verdicts_persist_as_issues_and_rescore() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        conn.execute(
            "INSERT INTO projects(id, name, root_path) VALUES('p', 'p', '/tmp')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files(id, project_id, path, kind, grade, score, issue_count, modified_at)
             VALUES('f', 'p', 'f', 'CLAUDE.md', 'A', 100, 1, NULL)",
            [],
        )
        .unwrap();
        // one pre-existing deterministic issue (hi): baseline 100-15 = 85
        conn.execute(
            "INSERT INTO issues(file_id, severity, source, title, why) VALUES('f', 'hi', 'anthropic', 'Det', 'w')",
            [],
        )
        .unwrap();

        let verdicts = vec![
            crate::ai_rules::NlVerdict {
                rule_id: "anthropic-clarity".into(),
                title: "Vague directives".into(),
                severity: "mid".into(),
                source: "anthropic".into(),
                violates: true,
                explanation: "Too vague.".into(),
            },
            crate::ai_rules::NlVerdict {
                rule_id: "cursor-scoped".into(),
                title: "Bloated, unscoped content".into(),
                severity: "mid".into(),
                source: "cursor".into(),
                violates: false,
                explanation: "Fine.".into(),
            },
        ];

        // hi=1, mid=1 → 100 - 15 - 7 = 78 → C
        let (score, grade) = apply_nl_verdicts(&conn, "f", &verdicts).unwrap();
        assert_eq!((score, grade.as_str()), (78, "C"));
        let n: i64 = conn
            .query_row("SELECT COUNT(*) FROM issues WHERE file_id='f'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 2, "1 deterministic + 1 violating NL (pass verdicts add nothing)");

        // Re-running must replace, not duplicate.
        let (score2, _) = apply_nl_verdicts(&conn, "f", &verdicts).unwrap();
        assert_eq!(score2, 78);
        let n2: i64 = conn
            .query_row("SELECT COUNT(*) FROM issues WHERE file_id='f'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n2, 2);
        let (fscore, fcount): (i64, i64) = conn
            .query_row("SELECT score, issue_count FROM files WHERE id='f'", [], |r| {
                Ok((r.get(0)?, r.get(1)?))
            })
            .unwrap();
        assert_eq!((fscore, fcount), (78, 2));
    }
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd src-tauri && cargo test nl_verdicts_persist`
Expected: FAIL to compile — `apply_nl_verdicts` not found.

- [ ] **Step 5: Implement** — in `query.rs`:

```rust
/// Persist NL verdicts for a file: replace prior NL-sourced issues (tagged by
/// non-NULL rule_id), insert current violations, and rescore the file with the
/// unchanged formula. Returns `(score, grade_letter)`.
pub fn apply_nl_verdicts(
    conn: &Connection,
    file_id: &str,
    verdicts: &[crate::ai_rules::NlVerdict],
) -> rusqlite::Result<(u32, String)> {
    conn.execute(
        "DELETE FROM issues WHERE file_id = ?1 AND rule_id IS NOT NULL",
        [file_id],
    )?;
    for v in verdicts.iter().filter(|v| v.violates) {
        conn.execute(
            "INSERT INTO issues(file_id, rule_id, line, severity, source, title, why, fix_from, fix_to)
             VALUES(?1, ?2, NULL, ?3, ?4, ?5, ?6, NULL, NULL)",
            params![file_id, v.rule_id, v.severity, v.source, v.title, v.explanation],
        )?;
    }

    let (mut hi, mut mid, mut lo) = (0u32, 0u32, 0u32);
    {
        let mut stmt = conn.prepare("SELECT severity FROM issues WHERE file_id = ?1")?;
        let rows = stmt.query_map([file_id], |r| r.get::<_, String>(0))?;
        for row in rows {
            match row?.as_str() {
                "hi" => hi += 1,
                "mid" => mid += 1,
                _ => lo += 1,
            }
        }
    }
    let score = crate::engine::score_for_counts(hi, mid, lo);
    let grade = crate::engine::grade_for_score(score);
    conn.execute(
        "UPDATE files
         SET score = ?1, grade = ?2,
             issue_count = (SELECT COUNT(*) FROM issues WHERE file_id = ?3)
         WHERE id = ?3",
        params![score as i64, grade.letter(), file_id],
    )?;
    Ok((score, grade.letter().to_string()))
}
```

- [ ] **Step 6: Run tests**

Run: `cd src-tauri && cargo test`
Expected: PASS (note: `run_scan`'s wholesale `DELETE FROM issues` on rescan already clears stale NL issues — the spec's baseline-reset behavior — so no `scan.rs` change is needed).

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/engine.rs src-tauri/src/ai_rules.rs src-tauri/src/query.rs src-tauri/src/commands.rs
git commit -m "feat(engine): NL verdicts persist as rule_id-tagged issues and fold into the score"
```

---

### Task 8: `evaluate_nl_rules` — provider-gated, license only for custom

**Files:**
- Modify: `src-tauri/src/ai_rules.rs` (add `NlEvalResult`)
- Modify: `src-tauri/src/commands.rs` (`evaluate_nl_rules`, lines 222–267)

**Interfaces:**
- Consumes: `enabled_nl_rules(conn, include_custom)` (Task 6), `apply_nl_verdicts` (Task 7).
- Produces: command returns `NlEvalResult { verdicts: Vec<NlVerdict>, score: u32, grade: String }`. **No `PAID_GATE` in this command anymore.**

- [ ] **Step 1: Add the result type** (ai_rules.rs, below `NlVerdict`):

```rust
/// Result of an NL evaluation run: the verdicts plus the file's new score.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct NlEvalResult {
    pub verdicts: Vec<NlVerdict>,
    pub score: u32,
    pub grade: String,
}
```

- [ ] **Step 2: Rewrite the command** (replace the body of `evaluate_nl_rules`, keeping the `#[tauri::command] #[specta::specta]` attributes; update the doc comment):

```rust
/// Evaluate the built-in NL standards (free — needs only a configured
/// provider) plus, for licensed users, the custom NL rules. Persists
/// violations as issues and rescores the file (offer spec §5: the license
/// gates treatment, not diagnosis).
#[tauri::command]
#[specta::specta]
pub async fn evaluate_nl_rules(
    db: tauri::State<'_, AppDb>,
    file_id: String,
) -> Result<crate::ai_rules::NlEvalResult, String> {
    let (creds, content, rules) = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        let detail = query::get_file_detail(&conn, &file_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "File not found".to_string())?;
        let include_custom = entitlement_of(&conn).paid;
        let rules = query::enabled_nl_rules(&conn, include_custom).map_err(|e| e.to_string())?;
        (crate::ai::load_credentials(&conn), detail.content, rules)
    };

    if creds.provider == "none" || creds.key.is_empty() {
        return Err(
            "Connect an AI provider in Settings → AI to evaluate the prompting standards."
                .to_string(),
        );
    }

    let mut verdicts = Vec::new();
    for rule in rules {
        let (violates, explanation) =
            crate::ai_rules::evaluate(&creds, &rule.instruction, &content).await?;
        verdicts.push(crate::ai_rules::NlVerdict {
            rule_id: rule.id,
            title: rule.title,
            severity: rule.severity,
            source: rule.source,
            violates,
            explanation,
        });
    }

    let (score, grade) = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        query::apply_nl_verdicts(&conn, &file_id, &verdicts).map_err(|e| e.to_string())?
    };
    Ok(crate::ai_rules::NlEvalResult {
        verdicts,
        score,
        grade,
    })
}
```

- [ ] **Step 3: Verify the license gate still guards treatment.** Confirm `PAID_GATE` remains used by `suggest_fix` (commands.rs ~line 405) and any apply/auto-fix commands, and is no longer referenced by `evaluate_nl_rules`:

Run: `grep -n "PAID_GATE" src-tauri/src/commands.rs`
Expected: the constant + rewrite/fix call sites only.

- [ ] **Step 4: Run all Rust tests (also regenerates `src/lib/bindings.ts` with `NlEvalResult`)**

Run: `cd src-tauri && cargo test && cargo clippy && cargo fmt`
Expected: PASS, bindings file updated.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/ai_rules.rs src/lib/bindings.ts
git commit -m "feat(ai): NL standards eval is provider-gated; license gates custom rules only"
```

---

### Task 9: Frontend — panel becomes "AI standards", gate on provider only

**Files:**
- Modify: `src/screens/Detail/Detail.tsx` (line 243)
- Modify: `src/screens/Detail/NlRulesPanel.tsx`

**Interfaces:**
- Consumes: `NlEvalResult` from regenerated bindings; `reload` from `useFileDetail` (already returned by the hook).
- Produces: `NlRulesPanel({ fileId, onApplied }: { fileId: string; onApplied?: () => void })`.

- [ ] **Step 1: Ungate the panel from the license.** In `Detail.tsx:243` replace:

```tsx
      {aiReady && entitled && <NlRulesPanel fileId={detail.id} />}
```

with:

```tsx
      {aiReady && <NlRulesPanel fileId={detail.id} onApplied={() => void reload()} />}
```

(`entitled` stays in use for fix/rewrite gating elsewhere in the screen — do not remove it from the hook.)

- [ ] **Step 2: Update the panel.** In `NlRulesPanel.tsx`:

```tsx
import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { commands, type NlVerdict } from "@/lib/ipc";

/** Runs the built-in prompting standards (plus any custom NL rules, when
 * licensed) against a file via the AI provider, folding hits into the score. */
export function NlRulesPanel({
  fileId,
  onApplied,
}: {
  fileId: string;
  onApplied?: () => void;
}) {
  const [verdicts, setVerdicts] = useState<NlVerdict[] | null>(null);
  const [newScore, setNewScore] = useState<{ score: number; grade: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    setBusy(true);
    setError(null);
    const res = await commands.evaluateNlRules(fileId);
    if (res.status === "ok") {
      setVerdicts(res.data.verdicts);
      setNewScore({ score: res.data.score, grade: res.data.grade });
      onApplied?.();
    } else setError(res.error);
    setBusy(false);
  };
```

Keep the existing JSX below, with these copy changes:
- Panel title `Custom AI rules` → `AI standards`
- Button label `Check custom rules` → `Check standards`
- Description → `Audit this file against the built-in prompting standards (Anthropic, OpenAI, Cursor, community) — plus your own AI rules on the Pro tier. Violations fold into the score.`
- The `verdicts.length === 0` empty-state can stay (it is now unreachable in practice but harmless).
- The all-pass line `All {n} custom rule{s} pass.` → `All {n} standard{s} pass.`
- After the verdict list (and also when all pass), render the rescore line when `newScore` is set:

```tsx
      {newScore && (
        <div className="faint" style={{ fontSize: 12, marginTop: 10 }}>
          Score is now {newScore.score} ({newScore.grade}).
        </div>
      )}
```

- [ ] **Step 3: Typecheck + frontend tests**

Run: `pnpm test && pnpm lint`
Expected: PASS. If the TS build flags `res.data` shape changes anywhere else, fix those call sites to use `.verdicts`.

- [ ] **Step 4: Commit**

```bash
git add src/screens/Detail/
git commit -m "feat(detail): AI standards panel — provider-gated, shows rescored grade"
```

---

### Task 10: Spec alignment, full CI, PR

**Files:**
- Modify: `docs/superpowers/specs/2026-06-20-prompting-standards-design.md` (Decisions table + §D wording)

- [ ] **Step 1: Record the amendment in the #72 spec.** In the Decisions table, replace the Default-state row:

```markdown
| Default state | **Enabled by default** — fires on the explicit NL action whenever a provider is configured (**free**; license not required — amended by the 2026-07-02 offer spec §5). |
```

And in section D, change `**evaluate_nl_rules (paid)**` → `**evaluate_nl_rules (provider-gated; custom rules require a license)**`, and the user-flow line `run AI standards (enriches score, paid)` → `run AI standards (enriches score; free with your own provider)`.

- [ ] **Step 2: Full local CI**

Run: `pnpm lint && pnpm test && cd src-tauri && cargo fmt --check && cargo clippy && cargo test && cd ..`
Expected: all PASS.

- [ ] **Step 3: Commit, push, PR**

```bash
git add docs/superpowers/specs/2026-06-20-prompting-standards-design.md
git commit -m "docs(spec): record provider-gate amendment on NL catalog eval"
git push -u origin feat/72-real-standards
gh pr create --title "feat(rules): built-in NL standards catalog, provider-gated, scored (#72)" \
  --body "25-standard NL catalog (Anthropic/OpenAI/Cursor/community) seeded as first-class rules, evaluated by the user's provider **without a license** (offer spec §5), violations persisted as rule_id-tagged issues and folded into the unchanged scoring formula. Custom NL rules stay licensed. Includes Source::Cursor, the committed standards reference doc with catalog parity test, and the provider-only gate in the Detail panel.

Closes #72"
```

Expected: PR opens against `main` with green CI.

---

## Self-review notes

- **Spec coverage:** catalog module (Task 3), notes doc + parity (Task 4), kind column + seeding (Tasks 1, 5), list/union wiring (Task 6), two-phase score lifecycle (Task 7 — `run_scan`'s full wipe covers the baseline reset), Source::Cursor (Task 2), gate amendment (Tasks 8–9), spec doc alignment (Task 10). Out-of-scope items from the spec (no deterministic-rule changes, no crawler changes, no recalibration) are respected — no task touches them.
- **Type consistency:** `NlRuleRow` (Task 6) feeds `NlVerdict{source}` (Task 7) feeds `NlEvalResult` (Task 8) feeds `res.data.verdicts` (Task 9). `apply_nl_verdicts` returns `(u32, String)` and Task 8 destructures it as such.
- **Known judgment calls recorded:** NL-issue tagging uses `issues.rule_id IS NOT NULL` (deterministic issues don't persist rule ids today); if deterministic issues ever start persisting `rule_id`, switch the delete to match catalog + custom-NL ids explicitly.
