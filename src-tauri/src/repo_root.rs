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

/// Find the *nearest* project root that owns `file_path` — the base to
/// resolve manifest-relative facts (scripts, lockfiles, sibling paths)
/// against in a monorepo. Unlike [`find_repo_root`] (always the git
/// worktree root), this walks up from the file looking for the closest
/// ancestor with a manifest (`package.json`, `Cargo.toml`, `pyproject.toml`,
/// `go.mod`), so `packages/api/CLAUDE.md` resolves against
/// `packages/api/package.json` rather than the monorepo root's.
///
/// The walk stops at (and includes) the git worktree root if one exists: a
/// manifest above the worktree root doesn't belong to this project. If no
/// manifest is found between the file and the worktree root, falls back to
/// the worktree root itself (same as [`find_repo_root`]). Outside of a git
/// repo, falls back to the same unbounded ancestor-manifest search
/// [`find_repo_root`] uses.
pub fn resolution_root(file_path: &Path) -> Option<PathBuf> {
    let start = file_path.parent()?;

    if let Ok(repo) = Repository::discover(start) {
        let Some(workdir) = repo.workdir() else {
            return None; // bare repository — no working tree to ground against
        };
        let workdir = workdir.to_path_buf();

        let mut dir = start.to_path_buf();
        loop {
            if MANIFEST_MARKERS.iter().any(|m| dir.join(m).exists()) {
                return Some(dir);
            }
            if dir == workdir {
                return Some(workdir); // inclusive boundary, nothing found above the file
            }
            dir = match dir.parent() {
                Some(p) => p.to_path_buf(),
                None => return Some(workdir), // shouldn't happen if workdir is an ancestor
            };
        }
    }

    // No git repo at all — same fallback chain as `find_repo_root`.
    find_repo_root(file_path)
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

    #[test]
    fn resolution_root_prefers_nearest_manifest_in_a_monorepo() {
        let dir = tempfile::tempdir().unwrap();
        git2::Repository::init(dir.path()).unwrap();
        fs::write(dir.path().join("package.json"), "{}").unwrap(); // monorepo root manifest
        fs::create_dir_all(dir.path().join("packages/api")).unwrap();
        fs::write(dir.path().join("packages/api/package.json"), "{}").unwrap();
        let file = dir.path().join("packages/api/CLAUDE.md");
        fs::write(&file, "hi").unwrap();

        let root = resolution_root(&file).unwrap();
        assert_eq!(
            root.canonicalize().unwrap(),
            dir.path().join("packages/api").canonicalize().unwrap()
        );
    }

    #[test]
    fn resolution_root_falls_back_to_git_root_when_no_nested_manifest() {
        let dir = tempfile::tempdir().unwrap();
        git2::Repository::init(dir.path()).unwrap();
        fs::write(dir.path().join("package.json"), "{}").unwrap();
        fs::create_dir_all(dir.path().join("docs/nested")).unwrap();
        let file = dir.path().join("docs/nested/AGENTS.md");
        fs::write(&file, "hi").unwrap();

        let root = resolution_root(&file).unwrap();
        assert_eq!(
            root.canonicalize().unwrap(),
            dir.path().canonicalize().unwrap()
        );
    }
}
