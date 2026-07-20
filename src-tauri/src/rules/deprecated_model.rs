use std::sync::OnceLock;

use regex::Regex;

use super::{line_at, line_text, negated_nearby};
use crate::engine::{Finding, Fix, Rule, Severity, Source};

/// How many words back on the same line to look for a negation cue ("do NOT
/// use claude-2") before treating a mention as an instruction to use it.
const NEGATION_WINDOW: usize = 4;

/// Flags model ids that providers have already retired. Deliberately narrow:
/// pinning a *current* model is a style choice (not checked here); pinning a
/// *retired* one is a verifiable fact — the instruction will silently start
/// failing or falling back the day the provider turns the id off.
///
/// Keep this list current — model deprecations move fast. It only grows
/// (never remove an id once retired), and only ever adds ids that are
/// unambiguously end-of-life, to keep this rule at zero false positives.
pub struct DeprecatedModel;

/// Ordered longest/most-specific first, so alternation picks the precise
/// variant over a shorter prefix (matters for the reported string, not for
/// whether the rule fires).
const DEPRECATED_MODELS: &[&str] = &[
    "claude-2.1",
    "claude-2.0",
    "claude-2",
    "claude-instant-1.2",
    "claude-instant-1.1",
    "claude-instant-1",
    "claude-instant",
    "gpt-3.5-turbo-16k",
    "gpt-3.5-turbo-0613",
    "gpt-3.5-turbo-0301",
    "gpt-3.5-turbo",
    "gpt-3.5",
    "gpt-4-32k",
    "gpt-4-0613",
    "gpt-4-0314",
    "text-davinci-003",
    "text-davinci-002",
    "text-davinci-001",
    "text-curie-001",
    "text-babbage-001",
    "text-ada-001",
    "code-davinci-002",
    "gemini-pro",
];

fn pattern() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        let alternation = DEPRECATED_MODELS
            .iter()
            .map(|m| regex::escape(m))
            .collect::<Vec<_>>()
            .join("|");
        Regex::new(&format!(r"(?i)\b(?:{alternation})\b")).expect("valid deprecated-model regex")
    })
}

/// `\b` treats `-` as a non-word character, so it doesn't stop a match like
/// `gemini-pro` from also "matching" inside `gemini-pro-vision` — the regex
/// crate has no lookahead to rule that out in the pattern itself. Post-filter
/// instead: a real hit must be followed by end-of-string or a character that
/// isn't a hyphen or word character, so a longer, unlisted, differently
/// versioned id never gets truncated into a listed one.
fn is_hyphen_continuation(content: &str, end: usize) -> bool {
    content[end..]
        .chars()
        .next()
        .map(|c| c == '-' || c.is_alphanumeric() || c == '_')
        .unwrap_or(false)
}

impl Rule for DeprecatedModel {
    fn id(&self) -> &'static str {
        // Kept from the rule's original, broader incarnation ("no hardcoded
        // model names") so existing enable/disable toggles carry over.
        "no-hardcoded-model"
    }
    fn title(&self) -> &'static str {
        "Deprecated model name"
    }
    fn source(&self) -> Source {
        Source::Custom
    }
    fn severity(&self) -> Severity {
        Severity::Mid
    }
    fn why(&self) -> &'static str {
        "Providers retire old model ids on public deprecation schedules — pin to one of these and the instruction breaks the day it's turned off."
    }
    fn check(&self, content: &str) -> Vec<Finding> {
        pattern()
            .find_iter(content)
            .filter(|m| !is_hyphen_continuation(content, m.end()))
            .filter(|m| !negated_nearby(content, m.start(), NEGATION_WINDOW))
            .map(|m| {
                let line = line_at(content, m.start());
                Finding {
                    line: Some(line),
                    why: format!(
                        "“{}” is a deprecated model id that providers have retired.",
                        m.as_str()
                    ),
                    fix: Some(Fix {
                        from: line_text(content, line).trim().to_string(),
                        to: "Use the project's currently configured model.".to_string(),
                    }),
                }
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flags_deprecated_model_with_line_number() {
        let findings = DeprecatedModel.check("intro line\nAlways use claude-2 here\ndone");
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].line, Some(2));
        assert!(findings[0].fix.is_some());
    }

    #[test]
    fn flags_gpt35_family() {
        assert_eq!(
            DeprecatedModel
                .check("Use gpt-3.5-turbo-16k for cheap calls.")
                .len(),
            1
        );
    }

    #[test]
    fn ignores_current_generation_models() {
        assert!(DeprecatedModel
            .check("Always use gpt-4o or claude-3-5-sonnet for completions.")
            .is_empty());
    }

    #[test]
    fn ignores_configured_model_language() {
        assert!(DeprecatedModel
            .check("Use the project's configured model.")
            .is_empty());
    }

    // Adversarial-review repros (#92): a bare (unversioned) entry must not
    // match as a truncated prefix of a longer, unlisted, differently
    // versioned id.
    #[test]
    fn ignores_hyphen_continuation_of_a_bare_entry() {
        assert!(DeprecatedModel
            .check("We use gemini-pro-vision for image tasks.")
            .is_empty());
    }

    #[test]
    fn still_flags_the_bare_entry_on_its_own() {
        assert_eq!(DeprecatedModel.check("gemini-pro").len(), 1);
    }

    #[test]
    fn ignores_negated_mention() {
        assert!(DeprecatedModel
            .check("Do NOT use claude-2 for completions.")
            .is_empty());
    }
}
