//! Cheap repo-root detection for repo-grounded rules (#74).
//!
//! "Repo root" for an instruction file is the project directory it belongs
//! to: the git worktree root if the file lives inside one (handles both a
//! plain `.git` directory and a worktree's `.git` *file*), else the nearest
//! ancestor containing a recognizable project manifest. All checks are
//! bounded directory walks / `exists()` calls — never a full repo read —
//! and return `None` when nothing is found, so callers degrade gracefully.

use std::path::{Path, PathBuf};

use git2::Repository;

/// Manifest files that mark a directory as a project root when there's no
/// git repo to discover (a loose folder, or a git-less checkout).
const MANIFEST_MARKERS: &[&str] = &["package.json", "Cargo.toml", "pyproject.toml", "go.mod"];

/// Find the project root that owns `file_path`. Returns `None` if it can't
/// be determined — callers must treat that as "no repo context available"
/// rather than guessing.
pub fn find_repo_root(file_path: &Path) -> Option<PathBuf> {
    let start = file_path.parent()?;

    if let Ok(repo) = Repository::discover(start) {
        if let Some(workdir) = repo.workdir() {
            return Some(workdir.to_path_buf());
        }
        // Bare repository: no working tree to ground file paths against.
        return None;
    }

    let mut dir = start;
    loop {
        if MANIFEST_MARKERS.iter().any(|m| dir.join(m).exists()) {
            return Some(dir.to_path_buf());
        }
        dir = dir.parent()?;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn finds_git_repo_root_for_nested_file() {
        let dir = tempfile::tempdir().unwrap();
        git2::Repository::init(dir.path()).unwrap();
        fs::create_dir_all(dir.path().join("docs/nested")).unwrap();
        let file = dir.path().join("docs/nested/AGENTS.md");
        fs::write(&file, "hi").unwrap();

        let root = find_repo_root(&file).unwrap();
        assert_eq!(
            root.canonicalize().unwrap(),
            dir.path().canonicalize().unwrap()
        );
    }

    #[test]
    fn falls_back_to_package_json_when_no_git() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("package.json"), "{}").unwrap();
        let file = dir.path().join("AGENTS.md");
        fs::write(&file, "hi").unwrap();

        // Only assert the fallback fires when git2 doesn't find a repo
        // above this tempdir (true in CI/sandboxed environments).
        if Repository::discover(dir.path()).is_err() {
            let root = find_repo_root(&file).unwrap();
            assert_eq!(
                root.canonicalize().unwrap(),
                dir.path().canonicalize().unwrap()
            );
        }
    }

    #[test]
    fn none_when_nothing_found() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("AGENTS.md");
        fs::write(&file, "hi").unwrap();

        if Repository::discover(dir.path()).is_err() {
            assert!(find_repo_root(&file).is_none());
        }
    }
}
