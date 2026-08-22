//! Harness-neutral data model. Screens, IPC, rules and the store depend on
//! these types only — never on a specific harness module.

use std::collections::HashMap;

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize, specta::Type,
)]
#[serde(rename_all = "snake_case")]
pub enum ArtifactKind {
    Rule,
    Skill,
    Agent,
    Command,
    Hook,
    McpServer,
    Plugin,
    Settings,
}

impl ArtifactKind {
    pub const ALL: &'static [ArtifactKind] = &[
        Self::Rule,
        Self::Skill,
        Self::Agent,
        Self::Command,
        Self::Hook,
        Self::McpServer,
        Self::Plugin,
        Self::Settings,
    ];
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Rule => "rule",
            Self::Skill => "skill",
            Self::Agent => "agent",
            Self::Command => "command",
            Self::Hook => "hook",
            Self::McpServer => "mcp_server",
            Self::Plugin => "plugin",
            Self::Settings => "settings",
        }
    }
    pub fn parse(s: &str) -> Option<Self> {
        Self::ALL.iter().copied().find(|k| k.as_str() == s)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum Layer {
    Global,
    Project,
    Plugin,
}

impl Layer {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Global => "global",
            Self::Project => "project",
            Self::Plugin => "plugin",
        }
    }
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "global" => Some(Self::Global),
            "project" => Some(Self::Project),
            "plugin" => Some(Self::Plugin),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Artifact {
    pub harness: String,
    pub layer: Layer,
    pub project_path: Option<String>,
    pub kind: ArtifactKind,
    pub name: String,
    pub path: String,
    pub plugin_name: Option<String>,
    pub description: Option<String>,
    pub bytes: u64,
    pub hash: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProjectRef {
    pub harness: String,
    pub path: String,
    pub exists: bool,
    pub log_dir: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum InvocationKind {
    Skill,
    Agent,
    Mcp,
    Builtin,
}

impl InvocationKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Skill => "skill",
            Self::Agent => "agent",
            Self::Mcp => "mcp",
            Self::Builtin => "builtin",
        }
    }
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "skill" => Some(Self::Skill),
            "agent" => Some(Self::Agent),
            "mcp" => Some(Self::Mcp),
            "builtin" => Some(Self::Builtin),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Invocation {
    pub harness: String,
    pub session_id: String,
    pub tool_use_id: String,
    pub project_path: String,
    pub ts: String,
    pub tool_name: String,
    pub kind: InvocationKind,
    pub target: String,
    pub duration_ms: Option<i64>,
    pub is_error: bool,
    pub turn_tokens: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct SessionMeta {
    pub harness: String,
    pub id: String,
    pub project_path: String,
    pub log_path: String,
    pub started_at: Option<String>,
    pub ended_at: Option<String>,
    pub turns: i64,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub model: Option<String>,
}

/// Per-log-file byte offsets already indexed. Persisted in `sessions.byte_offset`.
#[derive(Debug, Clone, Default)]
pub struct UsageCursor {
    pub offsets: HashMap<String, u64>,
}

#[derive(Debug, Default)]
pub struct UsageBatch {
    pub sessions: Vec<SessionMeta>,
    pub invocations: Vec<Invocation>,
    /// Sessions whose log shrank/rotated: their cursor + rows must be reset
    /// before the batch is applied.
    pub reset_sessions: Vec<String>,
    pub skipped_lines: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kinds_have_stable_db_names_and_round_trip() {
        for kind in ArtifactKind::ALL {
            assert_eq!(ArtifactKind::parse(kind.as_str()), Some(*kind));
        }
        assert_eq!(ArtifactKind::McpServer.as_str(), "mcp_server");
        assert_eq!(ArtifactKind::parse("nope"), None);
        assert_eq!(Layer::parse("plugin"), Some(Layer::Plugin));
        assert_eq!(InvocationKind::Mcp.as_str(), "mcp");
    }
}
