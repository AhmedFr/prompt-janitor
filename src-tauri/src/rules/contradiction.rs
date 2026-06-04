use crate::engine::{Finding, Fix, Rule, Severity, Source};

/// Flags a single instruction that asks for opposite things (e.g. concise + thorough).
pub struct Contradiction;

const VERBOSE_WORDS: &[&str] = &[
    "thorough",
    "detailed",
    "comprehensive",
    "exhaustive",
    "in-depth",
];

impl Rule for Contradiction {
    fn id(&self) -> &'static str {
        "no-contradictions"
    }
    fn title(&self) -> &'static str {
        "Contradictory instructions"
    }
    fn source(&self) -> Source {
        Source::Anthropic
    }
    fn severity(&self) -> Severity {
        Severity::Hi
    }
    fn why(&self) -> &'static str {
        "Conflicting directives make the model guess. Give one clear instruction with a measurable bound."
    }
    fn check(&self, content: &str) -> Vec<Finding> {
        let mut findings = Vec::new();
        for (i, line) in content.lines().enumerate() {
            let lower = line.to_lowercase();
            if lower.contains("concise") && VERBOSE_WORDS.iter().any(|w| lower.contains(w)) {
                findings.push(Finding {
                    line: Some(i as u32 + 1),
                    why: "“Concise” conflicts with “thorough/detailed” in the same instruction."
                        .to_string(),
                    fix: Some(Fix {
                        from: line.trim().to_string(),
                        to: "Keep answers under 6 sentences unless asked to expand.".to_string(),
                    }),
                });
            }
        }
        findings
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flags_concise_but_thorough() {
        let findings = Contradiction.check("Be concise but also very thorough.");
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].line, Some(1));
    }

    #[test]
    fn ignores_single_directive() {
        assert!(Contradiction.check("Be concise.").is_empty());
    }
}
