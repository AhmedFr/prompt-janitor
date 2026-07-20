//! LLM-reviewer: turn a resulting diff into bucketed fix counts.
//! The real network call sits behind `Reviewer`; parsing/prompt are pure.

use crate::effects::ReviewBurden;
use serde::Deserialize;

/// Any backend that can answer a review prompt with text.
pub trait Reviewer {
    fn review(&self, prompt: &str) -> Result<String, String>;
}

/// Reviewer backed by `claude -p` (plain text), used to score review burden.
pub struct ClaudeReviewer {
    pub model: String,
}

impl Reviewer for ClaudeReviewer {
    fn review(&self, prompt: &str) -> Result<String, String> {
        let out = std::process::Command::new("claude")
            .args(["-p", prompt, "--output-format", "json", "--model", &self.model])
            .output()
            .map_err(|e| format!("spawn claude reviewer: {e}"))?;
        if !out.status.success() {
            return Err(String::from_utf8_lossy(&out.stderr).into_owned());
        }
        Ok(extract_result_text(&String::from_utf8_lossy(&out.stdout)))
    }
}

/// Claude Code's `--output-format json` wraps the final assistant text in a
/// `{"result": "..."}` object. Return that inner text when present; otherwise
/// fall back to the raw stdout so `parse_review` can still hunt for a JSON
/// object. Never fails — extraction is best-effort; parsing happens downstream.
fn extract_result_text(stdout: &str) -> String {
    #[derive(Deserialize)]
    struct Wrapper {
        result: Option<String>,
    }
    if let Ok(Wrapper { result: Some(r) }) = serde_json::from_str::<Wrapper>(stdout) {
        return r;
    }
    stdout.to_string()
}

/// Pinned rubric. Versioned with the suite; changing it bumps suite_version.
const RUBRIC: &str = "\
You are a strict senior reviewer. Given a diff a coding agent produced, \
count the fixes a human must still make before merge, bucketed by severity:\n\
- major: correctness, breakage, security, or missing required behavior\n\
- minor: quality, convention, or maintainability issues\n\
- nice: optional polish\n\
Do not use any tools or take any actions. Read only the diff below and respond with ONLY the JSON object on a single line, no prose before or after.\n\
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

    #[test]
    fn extract_result_pulls_inner_json_from_wrapper() {
        let wrapper = r#"{"type":"result","result":"{\"major\":2,\"minor\":1,\"nice\":0}","is_error":false}"#;
        let text = extract_result_text(wrapper);
        let rb = parse_review(&text).unwrap();
        assert_eq!(rb, ReviewBurden { major: 2.0, minor: 1.0, nice: 0.0 });
    }

    #[test]
    fn extract_result_falls_back_to_raw_stdout() {
        // no wrapper — a bare JSON object should pass straight through to parse_review
        let raw = r#"{"major":1,"minor":0,"nice":3}"#;
        let text = extract_result_text(raw);
        let rb = parse_review(&text).unwrap();
        assert_eq!(rb, ReviewBurden { major: 1.0, minor: 0.0, nice: 3.0 });
    }

    #[test]
    fn extract_result_handles_prose_wrapper_result() {
        // wrapper whose result has prose around the JSON — parse_review must still find it
        let wrapper = r#"{"result":"Here is my review:\n{\"major\":0,\"minor\":2,\"nice\":1}\nThanks"}"#;
        let text = extract_result_text(wrapper);
        let rb = parse_review(&text).unwrap();
        assert_eq!(rb, ReviewBurden { major: 0.0, minor: 2.0, nice: 1.0 });
    }
}
