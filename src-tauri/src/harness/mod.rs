//! Agent-harness plugin seam. Each harness (Claude Code, later Cursor/Codex…)
//! lives in its own module and is registered in [`all`].

pub mod claude_code;
pub mod model;

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
    Vec::new()
}

pub fn detected() -> Vec<Box<dyn Harness>> {
    all().into_iter().filter(|h| h.detect()).collect()
}

#[cfg(test)]
mod tests {
    #[test]
    fn registry_is_empty_until_a_harness_is_added() {
        // Task 8 turns this into a Claude Code assertion.
        assert_eq!(super::all().len(), 0);
    }
}
