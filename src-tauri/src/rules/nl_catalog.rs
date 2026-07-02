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
