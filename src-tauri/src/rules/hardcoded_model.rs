use std::sync::OnceLock;

use regex::Regex;

use super::{line_at, line_text};
use crate::engine::{Finding, Fix, Rule, Severity, Source};

/// Flags hard-coded model identifiers that silently go stale.
pub struct HardcodedModel;

fn pattern() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(
            r"(?i)\b(gpt-4o|gpt-4-turbo|gpt-4|gpt-3\.5-turbo|gpt-3\.5|o1-mini|o1-preview|o3-mini|claude-3-opus|claude-3-sonnet|claude-3-haiku|claude-3|claude-2|gemini-1\.5-pro|gemini-1\.5|gemini-pro|text-davinci-003)\b",
        )
        .expect("valid model regex")
    })
}

impl Rule for HardcodedModel {
    fn id(&self) -> &'static str {
        "no-hardcoded-model"
    }
    fn title(&self) -> &'static str {
        "Hard-coded model name"
    }
    fn source(&self) -> Source {
        Source::Karpathy
    }
    fn severity(&self) -> Severity {
        Severity::Hi
    }
    fn why(&self) -> &'static str {
        "Pin behaviors, not model versions — they silently go stale and break when the model is deprecated."
    }
    fn check(&self, content: &str) -> Vec<Finding> {
        pattern()
            .find_iter(content)
            .map(|m| {
                let line = line_at(content, m.start());
                Finding {
                    line: Some(line),
                    why: format!("Hard-coded model name “{}” will rot.", m.as_str()),
                    fix: Some(Fix {
                        from: line_text(content, line).trim().to_string(),
                        to: "Use the project's configured model.".to_string(),
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
    fn flags_model_with_line_number() {
        let findings = HardcodedModel.check("intro line\nAlways use gpt-4 here\ndone");
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].line, Some(2));
        assert!(findings[0].fix.is_some());
    }

    #[test]
    fn ignores_configured_model_language() {
        assert!(HardcodedModel
            .check("Use the project's configured model.")
            .is_empty());
    }
}
