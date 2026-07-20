use crate::engine::{Finding, Rule, Severity, Source};

/// Flags instruction files with almost no actual content — headings,
/// whitespace, and markdown punctuation stripped out leave under ~120
/// characters. A file that thin teaches the agent nothing.
pub struct EmptyStub;

const MIN_CONTENT_CHARS: usize = 120;

/// Strip markdown headings/list/quote markers and collapse whitespace, to
/// count only the substance of the file.
fn substantive_chars(content: &str) -> usize {
    content
        .lines()
        .map(|line| {
            line.trim_start()
                .trim_start_matches(['#', '-', '*', '>'])
                .trim()
        })
        .filter(|line| !line.is_empty())
        .map(|line| line.chars().count())
        .sum()
}

impl Rule for EmptyStub {
    fn id(&self) -> &'static str {
        "empty-stub"
    }
    fn title(&self) -> &'static str {
        "Instruction file is nearly empty"
    }
    fn source(&self) -> Source {
        Source::Custom
    }
    fn severity(&self) -> Severity {
        Severity::Mid
    }
    fn why(&self) -> &'static str {
        "This file is very short — it may be too brief to usefully steer your AI. Consider covering commands, conventions, and gotchas."
    }
    fn dimension(&self) -> crate::engine::Dimension {
        crate::engine::Dimension::Clarity
    }
    fn check(&self, content: &str) -> Vec<Finding> {
        if substantive_chars(content) >= MIN_CONTENT_CHARS {
            return Vec::new();
        }
        vec![Finding {
            line: None,
            why: "This file is very short — it may be too brief to usefully steer your AI. Consider covering commands, conventions, and gotchas.".to_string(),
            fix: None,
        }]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flags_near_empty_file() {
        assert_eq!(EmptyStub.check("# TODO\n\nfill this in later\n").len(), 1);
    }

    #[test]
    fn accepts_substantive_file() {
        let content = "\
# API Worker assistant

You are a senior Rust reviewer for the api-worker service. Keep answers
under six sentences unless asked to expand, and always respond in JSON
with keys summary and actions so downstream tooling can parse the result.
";
        assert!(EmptyStub.check(content).is_empty());
    }

    #[test]
    fn flags_file_with_only_headings_and_whitespace() {
        let findings = EmptyStub.check("# Title\n\n## Subtitle\n\n---\n");
        assert_eq!(findings.len(), 1);
    }
}
