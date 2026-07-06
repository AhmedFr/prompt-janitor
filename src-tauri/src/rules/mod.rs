//! Built-in deterministic rules (v1).
//!
//! Each rule lives in its own file and implements [`crate::engine::Rule`].
//! [`builtin_rules`] is the set used for grading.

mod contradiction;
mod dead_file_reference;
mod deprecated_model;
mod duplicate_rules;
mod empty_stub;
mod legacy_cursorrules;
mod missing_few_shot;
mod missing_output_format;
mod missing_role;
mod missing_script_reference;
mod nl_catalog;
mod package_manager_mismatch;
mod placeholder_rot;
mod stale_vs_churn;
mod token_budget;

pub use contradiction::Contradiction;
pub use dead_file_reference::DeadFileReference;
pub use deprecated_model::DeprecatedModel;
pub use duplicate_rules::DuplicateRules;
pub use empty_stub::EmptyStub;
pub use legacy_cursorrules::LegacyCursorrules;
pub use missing_few_shot::MissingFewShot;
pub use missing_output_format::MissingOutputFormat;
pub use missing_role::MissingRole;
pub use missing_script_reference::MissingScriptReference;
pub use nl_catalog::{builtin_nl_rules, BuiltinNlRule};
pub use package_manager_mismatch::PackageManagerMismatch;
pub use placeholder_rot::PlaceholderRot;
pub use stale_vs_churn::StaleVsChurn;
pub use token_budget::TokenBudget;

use crate::engine::Rule;

/// The built-in rule set, in display order.
///
/// The first five are the original content-only rules (#8). The rest are
/// repo-grounded "fact rules" (#74): they check the instruction file against
/// the actual repo on disk (dead paths, wrong package manager, missing
/// scripts, …) rather than judging prose, so they stay at zero false
/// positives — a rule that needs repo context it doesn't have simply
/// doesn't fire (see each rule's `check_ctx`).
pub fn builtin_rules() -> Vec<Box<dyn Rule>> {
    vec![
        Box::new(DeprecatedModel),
        Box::new(Contradiction),
        Box::new(MissingRole),
        Box::new(MissingFewShot),
        Box::new(MissingOutputFormat),
        Box::new(DeadFileReference),
        Box::new(PackageManagerMismatch),
        Box::new(MissingScriptReference),
        Box::new(TokenBudget),
        Box::new(PlaceholderRot),
        Box::new(DuplicateRules),
        Box::new(LegacyCursorrules),
        Box::new(StaleVsChurn),
        Box::new(EmptyStub),
    ]
}

/// 1-based line number containing byte offset `idx`.
pub(crate) fn line_at(content: &str, idx: usize) -> u32 {
    content[..idx].bytes().filter(|&b| b == b'\n').count() as u32 + 1
}

/// Text of the given 1-based line.
pub(crate) fn line_text(content: &str, line: u32) -> &str {
    content
        .lines()
        .nth(line.saturating_sub(1) as usize)
        .unwrap_or("")
}

/// Cue phrases that negate whatever they precede — "don't use X", "never run
/// Y", "avoid Z", "use A instead of B". Naming a forbidden thing looks
/// identical, at the regex level, to naming the thing you're instructed to
/// use; a nearby negation cue is the difference between the two.
const NEGATION_CUES: &[&str] = &["don't", "do not", "never", "avoid", "instead of", "not"];

/// True if a negation cue appears on the same line as `match_start`, within
/// `window` words immediately before it. Shared by rules that flag a named
/// thing (a package manager, a model id) without distinguishing "use X" from
/// "don't use X" at the pattern level.
pub(crate) fn negated_nearby(content: &str, match_start: usize, window: usize) -> bool {
    let line_start = content[..match_start]
        .rfind('\n')
        .map(|i| i + 1)
        .unwrap_or(0);
    let before = content[line_start..match_start].to_lowercase();
    let words: Vec<&str> = before.split_whitespace().collect();
    let take_from = words.len().saturating_sub(window);
    let recent = words[take_from..].join(" ");
    NEGATION_CUES.iter().any(|cue| recent.contains(cue))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::{evaluate, Grade, Severity};

    const API_WORKER: &str = "\
# API Worker assistant

You are an assistant.
Always use claude-2 for completions.
Be concise but also very thorough and detailed.
Handle the request and return a result.
Don't make mistakes.

[no examples provided]
";

    #[test]
    fn focal_fixture_grades_d_with_five_issues() {
        // #74 narrowed the model rule from "any hard-coded model" (Hi) to
        // "clearly deprecated model id" (Mid), so the fixture now names a
        // retired model (claude-2) and the severity mix shifted from
        // (2 hi, 2 mid, 1 lo)/53 to (1 hi, 3 mid, 1 lo)/61 — still 5 issues,
        // still a D. The new repo-grounded rules (#74) all need a repo root
        // or file path, which `evaluate` (content-only) doesn't provide, so
        // none of them fire here.
        let eval = evaluate(API_WORKER, &builtin_rules());
        let hi = eval
            .issues
            .iter()
            .filter(|i| i.severity == Severity::Hi)
            .count();
        let mid = eval
            .issues
            .iter()
            .filter(|i| i.severity == Severity::Mid)
            .count();
        let lo = eval
            .issues
            .iter()
            .filter(|i| i.severity == Severity::Lo)
            .count();
        assert_eq!((hi, mid, lo), (1, 3, 1), "issues: {:#?}", eval.issues);
        assert_eq!(eval.score, 61);
        assert_eq!(eval.grade, Grade::D);
    }

    #[test]
    fn clean_prompt_has_no_issues() {
        let clean = "\
You are a senior Rust reviewer for the api-worker service.
Keep answers under 6 sentences unless asked to expand.
Respond in JSON with keys summary and actions.

For example:
```
{}
```
";
        let eval = evaluate(clean, &builtin_rules());
        assert!(eval.issues.is_empty(), "unexpected: {:#?}", eval.issues);
        assert_eq!(eval.grade, Grade::A);
    }
}
