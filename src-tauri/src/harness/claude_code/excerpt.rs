//! The readable slice of a config file that one artifact row stands for.
//!
//! A hook, an MCP server and a settings file are all rows backed by a JSON
//! file that holds much more than the row — `~/.claude.json` carries history
//! and telemetry state, and any settings file can carry API keys under `env`.
//! Showing such a row means cutting out its own entry and masking whatever
//! could be a credential, never handing the raw file to the webview.

use serde_json::Value;

use crate::harness::model::ArtifactKind;

/// What a masked value reads as. Fixed-width, so its length says nothing about the secret's.
pub const REDACTED: &str = "••••••";

/// Keys whose object values are credentials by convention: environment
/// variables handed to a process, and HTTP headers sent to a remote server.
const SECRET_MAPS: &[&str] = &["env", "headers"];

/// The pretty-printed, redacted JSON for the artifact `kind`/`name` in the
/// config file `text`, or `None` when the kind is not config-derived or the
/// entry is no longer in the file.
pub fn excerpt(
    kind: ArtifactKind,
    name: &str,
    project_path: Option<&str>,
    text: &str,
) -> Option<String> {
    let json: Value = serde_json::from_str(text).ok()?;
    let mut picked = match kind {
        ArtifactKind::Settings => json,
        ArtifactKind::McpServer => mcp_server(&json, name, project_path)?,
        ArtifactKind::Hook => hook(&json, name)?,
        _ => return None,
    };
    redact(&mut picked);
    serde_json::to_string_pretty(&picked).ok()
}

/// A server registered under the project's entry in `~/.claude.json` wins
/// over a root-level one of the same name: that is the one a project-layer
/// row was scanned from. Files with no `projects` map fall through to the root.
fn mcp_server(json: &Value, name: &str, project_path: Option<&str>) -> Option<Value> {
    let nested =
        project_path.and_then(|p| json.get("projects")?.get(p)?.get("mcpServers")?.get(name));
    nested
        .or_else(|| json.get("mcpServers")?.get(name))
        .cloned()
}

fn hook(json: &Value, name: &str) -> Option<Value> {
    hook_entries(json)
        .into_iter()
        .find(|entry| entry.name == name)
        .map(|entry| {
            serde_json::json!({
                "event": entry.event,
                "matcher": entry.matcher,
                "hook": entry.hook,
            })
        })
}

/// One hook command inside a settings file's `hooks` map, with the name the
/// inventory gives its row.
pub(super) struct HookEntry {
    pub name: String,
    pub event: String,
    pub matcher: Value,
    pub hook: Value,
}

/// Every hook in `json`, named `"<event>: <command>"` (80 chars at most),
/// with `" #2"`, `" #3"`, … appended to repeats. The inventory and the
/// excerpt both name hooks through here, so a row always finds its entry.
pub(super) fn hook_entries(json: &Value) -> Vec<HookEntry> {
    let mut out = Vec::new();
    let Some(hooks) = json.get("hooks").and_then(|h| h.as_object()) else {
        return out;
    };
    let mut seen: std::collections::HashMap<String, u32> = std::collections::HashMap::new();
    for (event, matchers) in hooks {
        for m in matchers.as_array().into_iter().flatten() {
            for h in m
                .get("hooks")
                .and_then(|x| x.as_array())
                .into_iter()
                .flatten()
            {
                let cmd = h
                    .get("command")
                    .and_then(|c| c.as_str())
                    .unwrap_or("(inline)");
                let base: String = format!("{event}: {cmd}").chars().take(80).collect();
                let count = seen.entry(base.clone()).or_insert(0);
                *count += 1;
                let name = if *count == 1 {
                    base
                } else {
                    format!("{base} #{count}")
                };
                out.push(HookEntry {
                    name,
                    event: event.clone(),
                    matcher: m.get("matcher").cloned().unwrap_or(Value::Null),
                    hook: h.clone(),
                });
            }
        }
    }
    out
}

/// Masks every scalar under an `env` or `headers` object, at any depth.
fn redact(value: &mut Value) {
    match value {
        Value::Object(map) => {
            for (key, child) in map.iter_mut() {
                if SECRET_MAPS.contains(&key.as_str()) {
                    if let Value::Object(secrets) = child {
                        for secret in secrets.values_mut() {
                            if !secret.is_object() && !secret.is_array() {
                                *secret = Value::String(REDACTED.to_string());
                            }
                        }
                    }
                }
                redact(child);
            }
        }
        Value::Array(items) => items.iter_mut().for_each(redact),
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ArtifactKind as K;

    const CLAUDE_JSON: &str = r#"{
        "numStartups": 12,
        "history": ["secret prompt"],
        "mcpServers": {
            "posthog": {"command": "npx", "args": ["-y", "posthog"], "env": {"POSTHOG_KEY": "phx_123"}}
        },
        "projects": {
            "/code/app": {
                "mcpServers": {
                    "posthog": {"type": "http", "url": "https://mcp.example", "headers": {"Authorization": "Bearer abc"}}
                }
            }
        }
    }"#;

    fn parsed(s: &str) -> Value {
        serde_json::from_str(s).unwrap()
    }

    #[test]
    fn a_global_mcp_server_is_cut_out_and_its_env_masked() {
        let out = excerpt(K::McpServer, "posthog", None, CLAUDE_JSON).unwrap();
        let v = parsed(&out);
        assert_eq!(v["command"], "npx");
        assert_eq!(v["env"]["POSTHOG_KEY"], REDACTED);
        assert!(!out.contains("phx_123"));
        // Nothing else from the file leaks through.
        assert!(!out.contains("secret prompt"));
        assert!(!out.contains("numStartups"));
    }

    #[test]
    fn a_project_mcp_server_prefers_the_projects_entry_and_masks_headers() {
        let out = excerpt(K::McpServer, "posthog", Some("/code/app"), CLAUDE_JSON).unwrap();
        let v = parsed(&out);
        assert_eq!(v["url"], "https://mcp.example");
        assert_eq!(v["headers"]["Authorization"], REDACTED);
        assert!(!out.contains("Bearer abc"));
    }

    #[test]
    fn a_project_path_with_no_entry_falls_back_to_the_root_map() {
        let mcp_json = r#"{"mcpServers": {"figma": {"command": "figma-mcp"}}}"#;
        let out = excerpt(K::McpServer, "figma", Some("/code/app"), mcp_json).unwrap();
        assert_eq!(parsed(&out)["command"], "figma-mcp");
    }

    #[test]
    fn a_server_no_longer_in_the_file_is_none() {
        assert!(excerpt(K::McpServer, "gone", None, CLAUDE_JSON).is_none());
    }

    #[test]
    fn settings_come_back_whole_with_env_masked_at_any_depth() {
        let settings = r#"{
            "model": "opus",
            "env": {"ANTHROPIC_API_KEY": "sk-live", "DEBUG": 1},
            "mcpServers": {"x": {"env": {"TOKEN": "t0k"}}}
        }"#;
        let out = excerpt(K::Settings, "settings.json", None, settings).unwrap();
        let v = parsed(&out);
        assert_eq!(v["model"], "opus");
        assert_eq!(v["env"]["ANTHROPIC_API_KEY"], REDACTED);
        assert_eq!(v["env"]["DEBUG"], REDACTED);
        assert_eq!(v["mcpServers"]["x"]["env"]["TOKEN"], REDACTED);
        assert!(!out.contains("sk-live") && !out.contains("t0k"));
    }

    #[test]
    fn a_hook_is_found_by_its_inventory_name_including_repeats() {
        let settings = r#"{"hooks": {"PreToolUse": [
            {"matcher": "Bash", "hooks": [{"type": "command", "command": "lint"}]},
            {"matcher": "Edit", "hooks": [{"type": "command", "command": "lint", "timeout": 5}]}
        ]}}"#;
        let first = parsed(&excerpt(K::Hook, "PreToolUse: lint", None, settings).unwrap());
        assert_eq!(first["event"], "PreToolUse");
        assert_eq!(first["matcher"], "Bash");
        assert_eq!(first["hook"]["command"], "lint");

        let second = parsed(&excerpt(K::Hook, "PreToolUse: lint #2", None, settings).unwrap());
        assert_eq!(second["matcher"], "Edit");
        assert_eq!(second["hook"]["timeout"], 5);
    }

    #[test]
    fn markdown_kinds_and_malformed_json_are_none() {
        assert!(excerpt(K::Skill, "x", None, "{}").is_none());
        assert!(excerpt(K::Settings, "settings.json", None, "{not json").is_none());
    }
}
