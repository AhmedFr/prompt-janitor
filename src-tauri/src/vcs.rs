//! Optional git integration: stage + commit an applied fix onto a dedicated
//! `prompt-janitor/fix-*` branch so the change is reviewable. The caller treats
//! any error as "the file was written, it just wasn't committed".

use std::path::Path;

use git2::{Repository, Signature};

/// Commit `path` onto a new `prompt-janitor/fix-<id>` branch and switch to it.
/// `id` makes the branch name deterministic (the caller passes a timestamp).
/// Returns the branch name on success.
pub fn commit_file(path: &Path, id: &str, message: &str) -> Result<String, String> {
    let repo = Repository::discover(path.parent().unwrap_or(path))
        .map_err(|e| format!("Not inside a git repository ({e})"))?;
    // Canonicalize both sides so symlinked roots (e.g. macOS /var → /private/var)
    // don't defeat the prefix match.
    let workdir = repo
        .workdir()
        .ok_or_else(|| "Bare repositories aren't supported".to_string())?
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let abs = path.canonicalize().map_err(|e| e.to_string())?;
    let rel = abs
        .strip_prefix(&workdir)
        .map_err(|_| "File is outside the git repository".to_string())?
        .to_path_buf();

    let branch_name = format!("prompt-janitor/fix-{id}");

    // Branch off the current HEAD commit and point HEAD at the new branch so
    // the commit (and the modified working tree) live on the branch.
    let head_commit = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
    if let Some(commit) = &head_commit {
        repo.branch(&branch_name, commit, true)
            .map_err(|e| e.to_string())?;
        repo.set_head(&format!("refs/heads/{branch_name}"))
            .map_err(|e| e.to_string())?;
    }

    // Stage just this file and build a tree from the index.
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index.add_path(&rel).map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;
    let tree = repo
        .find_tree(index.write_tree().map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;

    let sig = repo
        .signature()
        .or_else(|_| Signature::now("Prompt Janitor", "janitor@local"))
        .map_err(|e| e.to_string())?;

    let parents: Vec<&git2::Commit> = head_commit.iter().collect();
    repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &parents)
        .map_err(|e| e.to_string())?;

    Ok(branch_name)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn init_repo(dir: &Path) -> Repository {
        let repo = Repository::init(dir).unwrap();
        let mut cfg = repo.config().unwrap();
        cfg.set_str("user.name", "Test").unwrap();
        cfg.set_str("user.email", "test@local").unwrap();
        repo
    }

    fn initial_commit(repo: &Repository, dir: &Path) {
        fs::write(dir.join("AGENTS.md"), "use gpt-4\n").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(Path::new("AGENTS.md")).unwrap();
        index.write().unwrap();
        let tree = repo.find_tree(index.write_tree().unwrap()).unwrap();
        let sig = Signature::now("Test", "test@local").unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "init", &tree, &[])
            .unwrap();
    }

    #[test]
    fn commits_the_fix_onto_a_named_branch() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path();
        let repo = init_repo(dir);
        initial_commit(&repo, dir);

        // Apply a "fix" to the working tree, then commit it.
        let file = dir.join("AGENTS.md");
        fs::write(&file, "use the configured model\n").unwrap();
        let branch = commit_file(&file, "42", "prompt-janitor: fix AGENTS.md").unwrap();

        assert_eq!(branch, "prompt-janitor/fix-42");
        let reopened = Repository::open(dir).unwrap();
        let b = reopened
            .find_branch("prompt-janitor/fix-42", git2::BranchType::Local)
            .unwrap();
        let msg = b
            .get()
            .peel_to_commit()
            .unwrap()
            .message()
            .unwrap()
            .to_string();
        assert!(msg.contains("fix AGENTS.md"));
    }

    #[test]
    fn errors_outside_a_repo() {
        let tmp = tempfile::tempdir().unwrap();
        let file = tmp.path().join("loose.md");
        fs::write(&file, "hi").unwrap();
        assert!(commit_file(&file, "1", "msg").is_err());
    }
}
