use crate::engine::{Finding, Rule, Severity, Source};

/// Flags prompts that provide no worked examples.
pub struct MissingFewShot;

const EXAMPLE_HINTS: &[&str] = &["for example", "e.g.", "example:", "examples:", "```"];

impl Rule for MissingFewShot {
    fn id(&self) -> &'static str {
        "encourage-examples"
    }
    fn title(&self) -> &'static str {
        "No few-shot examples"
    }
    fn source(&self) -> Source {
        Source::Openai
    }
    fn severity(&self) -> Severity {
        Severity::Mid
    }
    fn why(&self) -> &'static str {
        "One or two worked examples reduce ambiguity far more than extra prose."
    }
    fn check(&self, content: &str) -> Vec<Finding> {
        let lower = content.to_lowercase();
        if EXAMPLE_HINTS.iter().any(|h| lower.contains(h)) {
            vec![]
        } else {
            vec![Finding {
                line: None,
                why: "No worked examples were provided.".to_string(),
                fix: None,
            }]
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flags_when_no_examples() {
        let findings = MissingFewShot.check("Do the task well. [no examples provided]");
        assert_eq!(findings.len(), 1);
    }

    #[test]
    fn accepts_with_example() {
        assert!(MissingFewShot.check("For example: foo -> bar").is_empty());
    }
}
