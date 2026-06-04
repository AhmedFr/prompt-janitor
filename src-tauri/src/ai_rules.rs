//! Natural-language rule evaluation (paid). Asks the configured provider
//! whether a file violates a plain-English rule. Parsing is pure and tested;
//! only [`evaluate`] touches the network.

use serde_json::Value;

use crate::ai::{complete, AiCredentials};

/// The provider's verdict on one NL rule for one file.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct NlVerdict {
    pub rule_id: String,
    pub title: String,
    pub severity: String,
    pub violates: bool,
    pub explanation: String,
}

const SYSTEM: &str = "You audit an AI instructions file (CLAUDE.md, AGENTS.md, and similar) against a single user-defined rule. Decide whether the file VIOLATES the rule. Respond with ONLY a JSON object and nothing else: {\"violates\": <true|false>, \"explanation\": <one short sentence>}. Set \"violates\" to true only when the file clearly breaks the rule; when unsure, return false.";

/// Build the user message: the rule plus the file under audit.
pub fn build_user_prompt(instruction: &str, content: &str) -> String {
    format!("Rule: {instruction}\n\n--- FILE START ---\n{content}\n--- FILE END ---")
}

fn extract_json(raw: &str) -> Option<&str> {
    let start = raw.find('{')?;
    let end = raw.rfind('}')?;
    (end > start).then(|| &raw[start..=end])
}

/// Parse the provider reply into `(violates, explanation)`. Defaults to
/// not-violating when the reply can't be understood, so a flaky response never
/// invents a violation.
pub fn parse_verdict(raw: &str) -> (bool, String) {
    if let Some(obj) = extract_json(raw).and_then(|s| serde_json::from_str::<Value>(s).ok()) {
        let violates = obj
            .get("violates")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let explanation = obj
            .get("explanation")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .trim()
            .to_string();
        let explanation = if explanation.is_empty() {
            if violates {
                "The file breaks this rule.".to_string()
            } else {
                "No violation found.".to_string()
            }
        } else {
            explanation
        };
        return (violates, explanation);
    }
    // Unparseable — default to a pass, surfacing a trimmed snippet for context.
    (false, raw.trim().chars().take(200).collect())
}

/// Evaluate one NL rule against `content` using `creds`.
pub async fn evaluate(
    creds: &AiCredentials,
    instruction: &str,
    content: &str,
) -> Result<(bool, String), String> {
    let user = build_user_prompt(instruction, content);
    let raw = complete(creds, SYSTEM, &user).await?;
    Ok(parse_verdict(&raw))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_violation() {
        let (v, why) = parse_verdict(r#"{"violates": true, "explanation": "Mentions Slack."}"#);
        assert!(v);
        assert_eq!(why, "Mentions Slack.");
    }

    #[test]
    fn parses_a_pass() {
        let (v, why) = parse_verdict(r#"{"violates": false, "explanation": "Clean."}"#);
        assert!(!v);
        assert_eq!(why, "Clean.");
    }

    #[test]
    fn unwraps_fenced_json() {
        let (v, _) = parse_verdict("```json\n{\"violates\": true, \"explanation\": \"x\"}\n```");
        assert!(v);
    }

    #[test]
    fn defaults_to_pass_when_unparseable() {
        let (v, why) = parse_verdict("I think it's probably fine.");
        assert!(!v);
        assert!(why.contains("probably fine"));
    }

    #[test]
    fn fills_in_a_missing_explanation() {
        let (v, why) = parse_verdict(r#"{"violates": true}"#);
        assert!(v);
        assert!(!why.is_empty());
    }
}
