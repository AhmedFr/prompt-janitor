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

/// The project a log directory belongs to, as `(path, exists_on_disk)`.
///
/// The slug is the anchor and the logged `cwd` only says where to start
/// looking: `cwd` can be a subdirectory the session was started in, or — for a
/// git worktree under `<repo>/.claude/worktrees` — the parent repo, so taking
/// it at face value merges distinct projects. We walk `cwd` and its ancestors
/// and keep the first one that re-encodes to this slug. Failing that (a `cwd`
/// from a different machine, or no logs at all) the slug is decoded against the
/// disk, and failing that it stands in for itself.
pub(super) fn resolve_project_path(dir: &Path, slug: &str) -> (String, bool) {
    if let Some(cwd) = cwd_from_logs(dir) {
        let mut candidate = Some(Path::new(&cwd));
        while let Some(p) = candidate {
            if slug::encode(p) == slug {
                return (p.to_string_lossy().into_owned(), p.is_dir());
            }
            candidate = p.parent();
        }
    }
    if let Some((path, resolved)) = slug::decode_slug_fs(slug) {
        let exists = resolved && path.is_dir();
        return (path.to_string_lossy().into_owned(), exists);
    }
    (slug.to_string(), false)
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

    fn home_root(&self) -> Option<std::path::PathBuf> {
        self.home.as_ref().map(|h| h.root.clone())
    }

    fn projects(&self) -> Vec<ProjectRef> {
        let Some(home) = &self.home else {
            return Vec::new();
        };
        let mut by_path: BTreeMap<String, ProjectRef> = BTreeMap::new();
        let Ok(dirs) = std::fs::read_dir(home.projects_dir()) else {
            return Vec::new();
        };
        let mut dirs: Vec<_> = dirs.flatten().filter(|d| d.path().is_dir()).collect();
        dirs.sort_by_key(|d| d.file_name());
        for d in dirs {
            let slug_name = d.file_name().to_string_lossy().into_owned();
            let (path, exists) = resolve_project_path(&d.path(), &slug_name);
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
            Scope::Project(p) => inventory::project_artifacts(home, Path::new(p)),
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
        // 5 in the session log + 1 in its sub-agent transcript.
        assert_eq!(h.index_usage(&mut cursor).invocations.len(), 6);
    }

    #[test]
    fn undetected_home_is_inert() {
        let h = ClaudeCode { home: None };
        assert!(!h.detect());
        assert!(h.projects().is_empty());
        assert!(h.inventory(&Scope::Global).is_empty());
    }

    /// Writes `projects/<slug>/0001-session.jsonl` carrying `cwd`.
    fn log_dir_with_cwd(root: &Path, slug: &str, cwd: &Path) -> std::path::PathBuf {
        let dir = root.join("projects").join(slug);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(
            dir.join("0001-session.jsonl"),
            format!(r#"{{"type":"other","cwd":"{}"}}"#, cwd.to_string_lossy()),
        )
        .unwrap();
        dir
    }

    /// The slug is the anchor, the log `cwd` only says where to start looking:
    /// a worktree under `<repo>/.claude/worktrees` keeps its own identity even
    /// though its sessions log the parent repo as `cwd`.
    #[test]
    fn worktree_slug_is_not_collapsed_into_the_parent_repo() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        let repo = root.join("repo");
        let wt = repo.join(".claude/worktrees/wt");
        std::fs::create_dir_all(&wt).unwrap();
        let dir = log_dir_with_cwd(&root, &slug::encode(&wt), &repo);

        let (path, exists) = resolve_project_path(&dir, &slug::encode(&wt));
        assert_eq!(path, wt.to_string_lossy());
        assert!(exists);
    }

    /// A session started in a subdirectory reports that subdirectory as `cwd`;
    /// the project is the ancestor the slug names.
    #[test]
    fn cwd_below_the_project_root_walks_up_to_the_slugs_directory() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        let app = root.join("app");
        std::fs::create_dir_all(app.join("src")).unwrap();
        let dir = log_dir_with_cwd(&root, &slug::encode(&app), &app.join("src"));

        let (path, exists) = resolve_project_path(&dir, &slug::encode(&app));
        assert_eq!(path, app.to_string_lossy());
        assert!(exists);
    }

    /// Deleted project: nothing on disk to decode against, but a logged `cwd`
    /// that re-encodes to the slug still names it.
    #[test]
    fn cwd_wins_when_the_slug_no_longer_decodes_on_disk() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        let gone = root.join("gone/project");
        let dir = log_dir_with_cwd(&root, &slug::encode(&gone), &gone);

        let (path, exists) = resolve_project_path(&dir, &slug::encode(&gone));
        assert_eq!(path, gone.to_string_lossy());
        assert!(!exists, "the directory is gone");
    }

    #[test]
    fn projects_are_sorted_by_path() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        for name in ["zebra", "apple"] {
            let p = root.join(name);
            std::fs::create_dir_all(&p).unwrap();
            log_dir_with_cwd(&root, &slug::encode(&p), &p);
        }
        let ps = ClaudeCode::with_home(ClaudeHome::at(root.clone())).projects();
        assert_eq!(
            ps.iter().map(|p| p.path.as_str()).collect::<Vec<_>>(),
            vec![
                root.join("apple").to_string_lossy(),
                root.join("zebra").to_string_lossy()
            ]
        );
    }
}
