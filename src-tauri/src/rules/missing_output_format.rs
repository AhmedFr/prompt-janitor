use crate::engine::{Finding, Rule, Severity, Source};

/// Flags prompts that never state an expected output format.
pub struct MissingOutputFormat;

const FORMAT_HINTS: &[&str] = &[
    "json",
    "yaml",
    "markdown",
    "xml",
    "csv",
    "output format",
    "respond in",
    "respond with",
    "code block",
    "as a list",
    "as a table",
    "return a list",
    "return a table",
    "format:",
];

impl Rule for MissingOutputFormat {
    fn id(&self) -> &'static str {
        "specify-output-format"
    }
    fn title(&self) -> &'static str {
        "Output format not specified"
    }
    fn source(&self) -> Source {
        Source::Openai
    }
    fn severity(&self) -> Severity {
        Severity::Lo
    }
    fn why(&self) -> &'static str {
        "State the expected format (code block, JSON, prose) so results are consistent."
    }
    fn dimension(&self) -> crate::engine::Dimension {
        crate::engine::Dimension::Format
    }
    fn check(&self, content: &str) -> Vec<Finding> {
        let lower = content.to_lowercase();
        if FORMAT_HINTS.iter().any(|h| lower.contains(h)) {
            vec![]
        } else {
            vec![Finding {
                line: None,
                why: "No output format is specified.".to_string(),
                fix: None,
            }]
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flags_when_no_format() {
        let findings = MissingOutputFormat.check("Handle the request and return a result.");
        assert_eq!(findings.len(), 1);
    }

    #[test]
    fn accepts_explicit_format() {
        assert!(MissingOutputFormat.check("Respond in JSON.").is_empty());
    }
}
