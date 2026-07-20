use std::collections::HashMap;

use crate::engine::{Finding, Rule, Severity, Source};

/// Flags two lines/bullets that are identical after normalizing case and
/// whitespace (not fuzzy matching). Ignores anything short enough, or
/// punctuation-heavy enough, to plausibly repeat by coincidence (headings,
/// fences, list markers, markdown table separators) rather than by
/// copy-paste drift.
pub struct DuplicateRules;

/// Below this normalized length, a repeated line is too short to be a
/// meaningful "duplicated rule" — could be a heading, a fence, a divider.
const MIN_DUPLICATE_LEN: usize = 20;

/// A repeated line needs at least this many alphabetic words to be prose
/// worth flagging, as opposed to a markdown table separator or divider
/// that happens to repeat.
const MIN_ALPHA_WORDS: usize = 3;

fn normalize(line: &str) -> String {
    line.trim()
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Is `normalized` long enough, and word-like enough, to count as a
/// meaningful duplicated instruction? Excludes markdown table separators
/// (`| --- | --- |`), rules of dashes/equals, and similar punctuation-heavy
/// lines that can coincidentally repeat without being copy-paste drift.
fn is_meaningful(normalized: &str) -> bool {
    if normalized.len() <= MIN_DUPLICATE_LEN {
        return false;
    }
    let total = normalized.chars().count();
    let alnum = normalized.chars().filter(|c| c.is_alphanumeric()).count();
    if total == 0 || (total - alnum) * 2 > total {
        return false; // more than 50% non-alphanumeric
    }
    let alpha_words = normalized
        .split_whitespace()
        .filter(|w| !w.is_empty() && w.chars().all(|c| c.is_alphabetic()))
        .count();
    alpha_words >= MIN_ALPHA_WORDS
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
    fn dimension(&self) -> crate::engine::Dimension {
        crate::engine::Dimension::Consistency
    }
    fn check(&self, content: &str) -> Vec<Finding> {
        let mut first_seen: HashMap<String, u32> = HashMap::new();
        let mut findings = Vec::new();
        for (i, line) in content.lines().enumerate() {
            let normalized = normalize(line);
            if !is_meaningful(&normalized) {
                continue;
            }
            let this_line = i as u32 + 1;
            match first_seen.get(&normalized) {
                Some(&first_line) => {
                    findings.push(Finding {
                        line: Some(this_line),
                        why: format!(
                            "Duplicates line {first_line} — identical text appears twice."
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

    // Adversarial-review repro (#92): a repeated markdown table separator
    // row is long enough to clear MIN_DUPLICATE_LEN but is punctuation, not
    // prose — must never fire.
    #[test]
    fn ignores_repeated_table_separator_rows() {
        let content = "\
| Column A | Column B | Column C |
| -------- | -------- | -------- |
Some row of real content here.
| -------- | -------- | -------- |
";
        assert!(DuplicateRules.check(content).is_empty());
    }
}
