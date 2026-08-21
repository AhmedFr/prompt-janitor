//! Agent-harness plugin seam. Each harness (Claude Code, later Cursor/Codex…)
//! lives in its own module and is registered in [`all`].

pub mod claude_code;
pub mod model;
pub mod time;

use model::{Artifact, ProjectRef, UsageBatch, UsageCursor};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Scope {
    Global,
    Project(String),
}

pub trait Harness: Send + Sync {
    fn id(&self) -> &'static str;
    fn display_name(&self) -> &'static str;
    fn detect(&self) -> bool;
    fn projects(&self) -> Vec<ProjectRef>;
    fn inventory(&self, scope: &Scope) -> Vec<Artifact>;
    fn index_usage(&self, cursor: &mut UsageCursor) -> UsageBatch;
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
