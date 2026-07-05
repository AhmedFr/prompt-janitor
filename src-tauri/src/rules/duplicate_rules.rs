use std::collections::HashMap;

use crate::engine::{Finding, Rule, Severity, Source};

/// Flags two near-identical, non-trivial lines/bullets in the same file.
/// Normalizes case and whitespace before comparing, and ignores anything
/// short enough to plausibly repeat by coincidence (headings, fences, list
/// markers) rather than by copy-paste drift.
pub struct DuplicateRules;

/// Below this normalized length, a repeated line is too short to be a
/// meaningful "duplicated rule" — could be a heading, a fence, a divider.
const MIN_DUPLICATE_LEN: usize = 20;

fn normalize(line: &str) -> String {
    line.trim()
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

impl Rule for DuplicateRules {
    fn id(&self) -> &'static str {
        "duplicate-rules"
    }
    fn title(&self) -> &'static str {
        "Duplicated instruction"
    }
    fn source(&self) -> Source {
        Source::Custom
    }
    fn severity(&self) -> Severity {
        Severity::Lo
    }
    fn why(&self) -> &'static str {
        "The same guidance stated twice always eventually drifts out of sync — say it once."
    }
    fn check(&self, content: &str) -> Vec<Finding> {
        let mut first_seen: HashMap<String, u32> = HashMap::new();
        let mut findings = Vec::new();
        for (i, line) in content.lines().enumerate() {
            let normalized = normalize(line);
            if normalized.len() <= MIN_DUPLICATE_LEN {
                continue;
            }
            let this_line = i as u32 + 1;
            match first_seen.get(&normalized) {
                Some(&first_line) => {
                    findings.push(Finding {
                        line: Some(this_line),
                        why: format!(
                            "Duplicates line {first_line} — near-identical text appears twice."
                        ),
                        fix: None,
                    });
                }
                None => {
                    first_seen.insert(normalized, this_line);
                }
            }
        }
        findings
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flags_near_identical_lines() {
        let content = "\
- Always respond in valid JSON with no extra prose.
- Keep answers under six sentences unless asked.
- always   RESPOND in valid json with no extra prose.
";
        let findings = DuplicateRules.check(content);
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].line, Some(3));
    }

    #[test]
    fn ignores_short_repeated_lines() {
        let content = "## Examples\n\nSome text.\n\n## Examples\n";
        assert!(DuplicateRules.check(content).is_empty());
    }

    #[test]
    fn ignores_distinct_lines() {
        let content = "You are a senior Rust reviewer for this service.\nRespond in JSON with keys summary and actions.\n";
        assert!(DuplicateRules.check(content).is_empty());
    }
}
