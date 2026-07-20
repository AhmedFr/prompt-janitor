use crate::engine::{Finding, Rule, Severity, Source};

/// Flags instruction files large enough to eat a meaningful share of every
/// session's context window.
///
/// Token counting needs a tokenizer we don't have; `chars / 4` is the
/// standard cheap heuristic (roughly right for English prose and code).
/// The engine has one severity per rule, so rather than splitting this into
/// two rules for a Lo/Mid band, we pick the simpler, honest option: a single
/// Mid-severity threshold. Below it, file size isn't worth a nit.
pub struct TokenBudget;

/// Estimated tokens (chars / 4) above which a file is flagged.
const TOKEN_BUDGET_THRESHOLD: usize = 3000;

fn estimated_tokens(content: &str) -> usize {
    content.chars().count() / 4
}

impl Rule for TokenBudget {
    fn id(&self) -> &'static str {
        "token-budget"
    }
    fn title(&self) -> &'static str {
        "Consumes a large share of the context window"
    }
    fn source(&self) -> Source {
        Source::Custom
    }
    fn severity(&self) -> Severity {
        Severity::Mid
    }
    fn why(&self) -> &'static str {
        "This file consumes a large share of every session's context window before any real work starts."
    }
    fn dimension(&self) -> crate::engine::Dimension {
        crate::engine::Dimension::Structure
    }
    fn check(&self, content: &str) -> Vec<Finding> {
        let tokens = estimated_tokens(content);
        if tokens <= TOKEN_BUDGET_THRESHOLD {
            return Vec::new();
        }
        vec![Finding {
            line: None,
            why: format!(
                "~{tokens} tokens (chars/4 estimate) — this file consumes a large share of every session's context window."
            ),
            fix: None,
        }]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flags_large_file() {
        let big = "a".repeat((TOKEN_BUDGET_THRESHOLD + 1) * 4);
        let findings = TokenBudget.check(&big);
        assert_eq!(findings.len(), 1);
    }

    #[test]
    fn accepts_small_file() {
        assert!(TokenBudget.check("A short instruction file.").is_empty());
    }

    #[test]
    fn accepts_file_right_at_the_threshold() {
        let at_threshold = "a".repeat(TOKEN_BUDGET_THRESHOLD * 4);
        assert!(TokenBudget.check(&at_threshold).is_empty());
    }
}
