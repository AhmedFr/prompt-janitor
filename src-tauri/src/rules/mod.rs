//! Built-in deterministic rules (v1).
//!
//! Each rule lives in its own file and implements [`crate::engine::Rule`].
//! [`builtin_rules`] is the set used for grading.

mod contradiction;
mod hardcoded_model;
mod missing_few_shot;
mod missing_output_format;
mod missing_role;

pub use contradiction::Contradiction;
pub use hardcoded_model::HardcodedModel;
pub use missing_few_shot::MissingFewShot;
pub use missing_output_format::MissingOutputFormat;
pub use missing_role::MissingRole;

use crate::engine::Rule;

/// The built-in rule set, in display order.
pub fn builtin_rules() -> Vec<Box<dyn Rule>> {
    vec![
        Box::new(HardcodedModel),
        Box::new(Contradiction),
        Box::new(MissingRole),
        Box::new(MissingFewShot),
        Box::new(MissingOutputFormat),
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::{evaluate, Grade, Severity};

    const API_WORKER: &str = "\
# API Worker assistant

You are an assistant.
Always use gpt-4 for completions.
Be concise but also very thorough and detailed.
Handle the request and return a result.
Don't make mistakes.

[no examples provided]
";

    #[test]
    fn focal_fixture_grades_d_with_five_issues() {
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
        assert_eq!((hi, mid, lo), (2, 2, 1), "issues: {:#?}", eval.issues);
        assert_eq!(eval.score, 53);
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
