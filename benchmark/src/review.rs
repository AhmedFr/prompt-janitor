//! LLM-reviewer: turn a resulting diff into bucketed fix counts.
//! The real network call sits behind `Reviewer`; parsing/prompt are pure.

use crate::effects::ReviewBurden;
use serde::Deserialize;

/// Any backend that can answer a review prompt with text.
pub trait Reviewer {
    fn review(&self, prompt: &str) -> Result<String, String>;
}

/// Pinned rubric. Versioned with the suite; changing it bumps suite_version.
const RUBRIC: &str = "\
You are a strict senior reviewer. Given a diff a coding agent produced, \
count the fixes a human must still make before merge, bucketed by severity:\n\
- major: correctness, breakage, security, or missing required behavior\n\
- minor: quality, convention, or maintainability issues\n\
- nice: optional polish\n\
Reply with ONLY a JSON object: {\"major\":N,\"minor\":N,\"nice\":N}";

/// Build the reviewer prompt for one resulting diff.
pub fn build_review_prompt(diff: &str) -> String {
    format!("{RUBRIC}\n\n--- DIFF ---\n{diff}")
}

#[derive(Deserialize)]
struct Counts {
    major: f64,
    minor: f64,
    nice: f64,
}

/// Extract the first `{...}` JSON object from `raw` and parse it.
pub fn parse_review(raw: &str) -> Result<ReviewBurden, String> {
    let start = raw.find('{').ok_or("no JSON object in review")?;
    let end = raw.rfind('}').ok_or("no closing brace in review")?;
    if end <= start {
        return Err("malformed JSON braces".into());
    }
    let c: Counts = serde_json::from_str(&raw[start..=end]).map_err(|e| e.to_string())?;
    Ok(ReviewBurden { major: c.major, minor: c.minor, nice: c.nice })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prompt_includes_diff_and_rubric() {
        let p = build_review_prompt("diff --git a/x b/x");
        assert!(p.contains("diff --git a/x b/x"));
        assert!(p.contains("major"));
        assert!(p.contains("minor"));
        assert!(p.contains("nice"));
    }

    #[test]
    fn parses_clean_json() {
        let r = parse_review(r#"{"major":3,"minor":2,"nice":1}"#).unwrap();
        assert_eq!(r, ReviewBurden { major: 3.0, minor: 2.0, nice: 1.0 });
    }

    #[test]
    fn parses_json_embedded_in_prose() {
        let raw = "Here is my review:\n{\"major\":1,\"minor\":0,\"nice\":4}\nThanks!";
        let r = parse_review(raw).unwrap();
        assert_eq!(r, ReviewBurden { major: 1.0, minor: 0.0, nice: 4.0 });
    }

    #[test]
    fn errors_on_no_json() {
        assert!(parse_review("no json here").is_err());
    }
}
