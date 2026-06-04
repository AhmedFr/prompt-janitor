//! AI rewrite generation (paid). Turns one flagged issue into a concrete
//! `from → to` edit via the configured provider, replacing the static fix text.
//!
//! Parsing is kept pure (`parse_suggestion`) so it can be unit-tested without a
//! live provider; only [`suggest`] touches the network.

use serde_json::Value;

use crate::ai::{complete, AiCredentials};
use crate::query::IssueDetail;

/// A provider-generated edit for one issue. `from` is an exact slice of the
/// file to replace (empty for a pure insertion); `to` is the replacement.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct FixSuggestion {
    pub from: String,
    pub to: String,
    pub note: String,
}

const SYSTEM: &str = "You are a prompt-engineering editor. You fix a single flagged issue in an AI instructions file (CLAUDE.md, AGENTS.md, .cursorrules, and similar). Make the smallest change that resolves the issue while preserving the author's voice and surrounding content. Respond with ONLY a JSON object and nothing else: {\"from\": <exact contiguous substring copied verbatim from the file to replace>, \"to\": <the replacement text>, \"note\": <one short sentence describing the change>}. The \"from\" value MUST be an exact substring of the file. For a pure addition, set \"from\" to \"\" and put the new text in \"to\".";

/// Build the user message: the issue plus the file it lives in.
pub fn build_user_prompt(content: &str, issue: &IssueDetail) -> String {
    let line = issue
        .line
        .map(|l| format!(" (around line {l})"))
        .unwrap_or_default();
    format!(
        "Issue: {title}{line}\nWhy it matters: {why}\n\n--- FILE START ---\n{content}\n--- FILE END ---",
        title = issue.title,
        why = issue.why,
    )
}

/// Pull the outermost `{...}` object out of a reply that may be fenced or prosey.
fn extract_json(raw: &str) -> Option<&str> {
    let start = raw.find('{')?;
    let end = raw.rfind('}')?;
    (end > start).then(|| &raw[start..=end])
}

/// Turn a raw provider reply into a [`FixSuggestion`], grounding the `from`
/// snippet against the file so the UI never shows a phantom diff.
pub fn parse_suggestion(raw: &str, content: &str) -> FixSuggestion {
    if let Some(obj) = extract_json(raw).and_then(|s| serde_json::from_str::<Value>(s).ok()) {
        let from = obj
            .get("from")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        let to = obj
            .get("to")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        let mut note = obj
            .get("note")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();

        // The "from" must be an exact slice of the file, or there's nothing to
        // anchor an apply to later. Flag (don't drop) a mismatch.
        if !from.is_empty() && !content.contains(&from) {
            note = if note.is_empty() {
                "This rewrite couldn't be anchored exactly to the file.".to_string()
            } else {
                format!("{note} (couldn't anchor the original snippet exactly)")
            };
        }

        return FixSuggestion { from, to, note };
    }

    // No JSON came back — treat the whole reply as the replacement text.
    FixSuggestion {
        from: String::new(),
        to: raw.trim().to_string(),
        note: "Returned as freeform text.".to_string(),
    }
}

/// Generate a rewrite for `issue` within `content` using `creds`.
pub async fn suggest(
    creds: &AiCredentials,
    content: &str,
    issue: &IssueDetail,
) -> Result<FixSuggestion, String> {
    let user = build_user_prompt(content, issue);
    let raw = complete(creds, SYSTEM, &user).await?;
    Ok(parse_suggestion(&raw, content))
}

#[cfg(test)]
mod tests {
    use super::*;

    const FILE: &str = "You are a helpful bot.\nAlways use gpt-4.\nBe concise.";

    #[test]
    fn parses_a_clean_json_object() {
        let raw = r#"{"from": "Always use gpt-4.", "to": "Use the configured model.", "note": "Removed the hardcoded model."}"#;
        let s = parse_suggestion(raw, FILE);
        assert_eq!(s.from, "Always use gpt-4.");
        assert_eq!(s.to, "Use the configured model.");
        assert_eq!(s.note, "Removed the hardcoded model.");
    }

    #[test]
    fn unwraps_fenced_json_and_prose() {
        let raw = "Sure! Here is the fix:\n```json\n{\"from\": \"Be concise.\", \"to\": \"Be concise and cite sources.\", \"note\": \"Added sourcing.\"}\n```";
        let s = parse_suggestion(raw, FILE);
        assert_eq!(s.from, "Be concise.");
        assert_eq!(s.to, "Be concise and cite sources.");
    }

    #[test]
    fn flags_a_from_that_is_not_in_the_file() {
        let raw = r#"{"from": "Never invent code", "to": "x", "note": "tweak"}"#;
        let s = parse_suggestion(raw, FILE);
        assert!(s.note.contains("anchor"));
    }

    #[test]
    fn falls_back_to_freeform_when_no_json() {
        let raw = "Just rewrite the whole thing to be clearer.";
        let s = parse_suggestion(raw, FILE);
        assert_eq!(s.from, "");
        assert_eq!(s.to, raw);
        assert!(s.note.contains("freeform"));
    }

    #[test]
    fn allows_empty_from_for_insertions() {
        let raw = r#"{"from": "", "to": "Output format: return JSON.", "note": "Added a format section."}"#;
        let s = parse_suggestion(raw, FILE);
        assert_eq!(s.from, "");
        assert!(s.note.contains("format"));
    }
}
