//! Agent-harness plugin seam. Each harness (Claude Code, later Cursor/Codex…)
//! lives in its own module and is registered in [`all`].

pub mod claude_code;
pub mod model;
pub mod time;

use std::path::PathBuf;

use model::{Artifact, ArtifactKind, ProjectRef, UsageBatch, UsageCursor};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Scope {
    Global,
    Project(String),
}

pub trait Harness: Send + Sync {
    fn id(&self) -> &'static str;
    fn display_name(&self) -> &'static str;
    fn detect(&self) -> bool;
    /// Where the harness keeps its own configuration (`~/.claude` for Claude
    /// Code), once detected. The scan uses it to recognise roots that are too
    /// broad to walk: a project that *contains* the harness home is the user's
    /// home directory wearing a slug. `None` when the harness has no such
    /// directory, or is not installed.
    fn home_root(&self) -> Option<PathBuf> {
        None
    }
    fn projects(&self) -> Vec<ProjectRef>;
    fn inventory(&self, scope: &Scope) -> Vec<Artifact>;
    fn index_usage(&self, cursor: &mut UsageCursor) -> UsageBatch;
    /// The readable, redacted slice of `file_text` that one config-derived
    /// artifact row (a hook, an MCP server, a settings file) stands for.
    /// `None` means the kind is a file of its own, or its entry is gone.
    fn source_excerpt(
        &self,
        _kind: ArtifactKind,
        _name: &str,
        _project_path: Option<&str>,
        _file_text: &str,
    ) -> Option<String> {
        None
    }
}

/// The registered harness with this id, detected or not.
pub fn by_id(id: &str) -> Option<Box<dyn Harness>> {
    all().into_iter().find(|h| h.id() == id)
}

pub fn all() -> Vec<Box<dyn Harness>> {
    vec![Box::new(claude_code::ClaudeCode::new())]
}

pub fn detected() -> Vec<Box<dyn Harness>> {
    all().into_iter().filter(|h| h.detect()).collect()
}

#[cfg(test)]
mod tests {
    #[test]
    fn registry_lists_claude_code_first() {
        assert_eq!(
            super::all().iter().map(|h| h.id()).collect::<Vec<_>>(),
            vec!["claude_code"]
        );
    }
}
