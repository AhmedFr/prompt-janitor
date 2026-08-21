use serde_json::Value;

use crate::harness::model::InvocationKind;

/// Map a raw tool name (+ input) to an invocation kind and the artifact it targets.
pub fn classify(tool_name: &str, input: &Value) -> (InvocationKind, String) {
    match tool_name {
        "Skill" => (
            InvocationKind::Skill,
            input
                .get("skill")
                .and_then(Value::as_str)
                .unwrap_or("(unknown)")
                .to_string(),
        ),
        "Agent" => (
            InvocationKind::Agent,
            input
                .get("subagent_type")
                .and_then(Value::as_str)
                .unwrap_or("general-purpose")
                .to_string(),
        ),
        name => {
            if let Some(rest) = name.strip_prefix("mcp__") {
                if let Some((server, _tool)) = rest.split_once("__") {
                    if !server.is_empty() {
                        return (InvocationKind::Mcp, server.to_string());
                    }
                }
            }
            (InvocationKind::Builtin, name.to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::harness::model::InvocationKind as K;
    use serde_json::json;

    #[test]
    fn skill_agent_mcp_builtin() {
        assert_eq!(
            classify("Skill", &json!({"skill": "adapt"})),
            (K::Skill, "adapt".into())
        );
        assert_eq!(
            classify("Skill", &json!({"skill": "superpowers:brainstorming"})),
            (K::Skill, "superpowers:brainstorming".into())
        );
        assert_eq!(
            classify("Agent", &json!({"subagent_type": "Explore"})),
            (K::Agent, "Explore".into())
        );
        assert_eq!(
            classify("Agent", &json!({})),
            (K::Agent, "general-purpose".into())
        );
        assert_eq!(
            classify("mcp__playwright__browser_navigate", &json!({})),
            (K::Mcp, "playwright".into())
        );
        assert_eq!(
            classify("mcp__claude_ai_Gmail__authenticate", &json!({})),
            (K::Mcp, "claude_ai_Gmail".into())
        );
        assert_eq!(
            classify("mcp__broken", &json!({})),
            (K::Builtin, "mcp__broken".into())
        );
        assert_eq!(
            classify("Bash", &json!({"command": "ls"})),
            (K::Builtin, "Bash".into())
        );
        assert_eq!(
            classify("Skill", &json!({})),
            (K::Skill, "(unknown)".into())
        );
    }
}
