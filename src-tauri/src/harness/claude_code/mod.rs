//! Claude Code harness: `~/.claude` + per-project `.claude/` + session logs.

pub mod classify;
pub mod inventory;
pub mod log_index;
pub mod log_records;
pub mod paths;
pub mod plugins;
pub mod slug;
#[cfg(test)]
pub mod test_support;

use std::collections::BTreeMap;
use std::io::BufRead;
use std::path::Path;

use paths::ClaudeHome;

use crate::harness::model::{Artifact, ProjectRef, UsageBatch, UsageCursor};
use crate::harness::{Harness, Scope};

pub struct ClaudeCode {
    home: Option<ClaudeHome>,
}

impl ClaudeCode {
    pub fn new() -> Self {
        Self {
            home: ClaudeHome::detect(),
        }
    }
    pub fn with_home(home: ClaudeHome) -> Self {
        Self { home: Some(home) }
    }
}

impl Default for ClaudeCode {
    fn default() -> Self {
        Self::new()
    }
}

/// First `cwd` in the first 50 lines of any `.jsonl` log in `dir` —
/// authoritative over the lossy slug. Files are visited in name order so the
/// result is deterministic regardless of directory-read order.
fn cwd_from_logs(dir: &Path) -> Option<String> {
    let mut files: Vec<_> = std::fs::read_dir(dir)
        .ok()?
        .flatten()
        .map(|f| f.path())
        .filter(|p| p.extension().and_then(|e| e.to_str()) == Some("jsonl"))
        .collect();
    files.sort();
    for p in files {
        let Ok(file) = std::fs::File::open(&p) else {
            continue;
        };
        for line in std::io::BufReader::new(file).lines().take(50).flatten() {
            if let Some(rec) = log_records::parse_line(&line) {
                let cwd = match rec {
                    log_records::LogRecord::Assistant { cwd, .. }
                    | log_records::LogRecord::ToolResults { cwd, .. }
                    | log_records::LogRecord::Other { cwd, .. } => cwd,
                };
                if let Some(c) = cwd {
                    return Some(c);
                }
            }
        }
    }
    None
}

impl Harness for ClaudeCode {
    fn id(&self) -> &'static str {
        inventory::HARNESS_ID
    }
    fn display_name(&self) -> &'static str {
        "Claude Code"
    }
    fn detect(&self) -> bool {
        self.home.is_some()
    }

    fn projects(&self) -> Vec<ProjectRef> {
        let Some(home) = &self.home else {
            return Vec::new();
        };
        let mut by_path: BTreeMap<String, ProjectRef> = BTreeMap::new();
        let Ok(dirs) = std::fs::read_dir(home.projects_dir()) else {
            return Vec::new();
        };
        for d in dirs.flatten().filter(|d| d.path().is_dir()) {
            let slug_name = d.file_name().to_string_lossy().into_owned();
            let path = cwd_from_logs(&d.path())
                .or_else(|| {
                    slug::decode_slug_fs(&slug_name).map(|(p, _)| p.to_string_lossy().into_owned())
                })
                .unwrap_or_else(|| slug_name.clone());
            let exists = Path::new(&path).is_dir();
            by_path.entry(path.clone()).or_insert(ProjectRef {
                harness: inventory::HARNESS_ID.into(),
                path,
                exists,
                log_dir: Some(d.path().to_string_lossy().into_owned()),
            });
        }
        by_path.into_values().collect()
    }

    fn inventory(&self, scope: &Scope) -> Vec<Artifact> {
        let Some(home) = &self.home else {
            return Vec::new();
        };
        match scope {
            Scope::Global => {
                let mut a = inventory::global_artifacts(home);
                a.extend(plugins::plugin_artifacts(home));
                a
            }
            Scope::Project(p) => inventory::project_artifacts(Path::new(p)),
        }
    }

    fn index_usage(&self, cursor: &mut UsageCursor) -> UsageBatch {
        match &self.home {
            Some(home) => log_index::index_all(home, cursor),
            None => UsageBatch::default(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::harness::model::ArtifactKind as K;
    use crate::harness::{Harness, Scope};
    use test_support::fixture_home;

    #[test]
    fn detects_projects_and_marks_missing_ones() {
        let (_g, home) = fixture_home();
        let h = ClaudeCode::with_home(home.clone());
        assert!(h.detect());
        let mut ps = h.projects();
        ps.sort_by(|a, b| a.path.cmp(&b.path));
        assert_eq!(ps.len(), 2);
        assert_eq!(ps[0].path, home.root.join("work/app").to_string_lossy());
        assert!(ps[0].exists);
        assert!(!ps[1].exists);
    }

    #[test]
    fn inventory_per_scope_and_usage_index() {
        let (_g, home) = fixture_home();
        let h = ClaudeCode::with_home(home.clone());
        let global = h.inventory(&Scope::Global);
        assert!(global.iter().any(|a| a.kind == K::Plugin)); // plugins ride with the global scope
        assert!(global
            .iter()
            .any(|a| a.kind == K::Skill && a.name == "adapt"));
        let project = h.inventory(&Scope::Project(
            home.root.join("work/app").to_string_lossy().into_owned(),
        ));
        assert!(project
            .iter()
            .any(|a| a.kind == K::Skill && a.name == "deploy"));
        let mut cursor = Default::default();
        assert_eq!(h.index_usage(&mut cursor).invocations.len(), 5);
    }

    #[test]
    fn undetected_home_is_inert() {
        let h = ClaudeCode { home: None };
        assert!(!h.detect());
        assert!(h.projects().is_empty());
        assert!(h.inventory(&Scope::Global).is_empty());
    }
}
