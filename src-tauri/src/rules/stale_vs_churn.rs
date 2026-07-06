use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::engine::{Finding, Rule, RuleContext, Severity, Source};

/// Flags an instruction file that hasn't been touched in a long time while
/// the repo it lives in is clearly still active. Uses two cheap, bounded
/// signals: the file's own mtime (already read by the scanner) and the
/// mtime of `.git/FETCH_HEAD`/`HEAD`/`index` as a proxy for "repo activity"
/// (updated by fetch, commit, and checkout respectively). If the repo isn't
/// a plain git checkout (no `.git` directory — e.g. a worktree's `.git`
/// *file*, or no git at all) the signal isn't reliably determinable, so the
/// rule stays silent rather than guessing.
pub struct StaleVsChurn;

const STALE_AFTER_SECS: i64 = 180 * 24 * 60 * 60; // 180 days
const RECENT_ACTIVITY_SECS: i64 = 14 * 24 * 60 * 60; // 14 days

/// Seconds since the Unix epoch of the most recently modified of the
/// well-known git-activity files, or `None` if `.git` isn't a plain
/// directory with at least one of them.
fn repo_activity_unix(repo_root: &Path) -> Option<i64> {
    let git_dir = repo_root.join(".git");
    if !git_dir.is_dir() {
        return None; // missing, or a worktree gitlink file — not reliable here
    }
    ["FETCH_HEAD", "HEAD", "index"]
        .iter()
        .filter_map(|name| std::fs::metadata(git_dir.join(name)).ok()?.modified().ok())
        .filter_map(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .max()
}

impl Rule for StaleVsChurn {
    fn id(&self) -> &'static str {
        "stale-vs-churn"
    }
    fn title(&self) -> &'static str {
        "Instruction file is stale, repo isn't"
    }
    fn source(&self) -> Source {
        Source::Custom
    }
    fn severity(&self) -> Severity {
        Severity::Lo
    }
    fn why(&self) -> &'static str {
        "This file hasn't changed in over 6 months while the repository shows recent activity — worth a quick review to confirm it still matches reality."
    }
    fn check_ctx(&self, ctx: &RuleContext<'_>) -> Vec<Finding> {
        let Some(repo_root) = ctx.repo_root else {
            return Vec::new();
        };
        let Some(file_mtime) = ctx.modified_unix else {
            return Vec::new();
        };
        let Some(activity) = repo_activity_unix(repo_root) else {
            return Vec::new();
        };
        let Ok(now) = SystemTime::now().duration_since(UNIX_EPOCH) else {
            return Vec::new();
        };
        let now = now.as_secs() as i64;

        let file_age = now - file_mtime;
        let activity_age = now - activity;
        if file_age <= STALE_AFTER_SECS || activity_age > RECENT_ACTIVITY_SECS {
            return Vec::new();
        }

        vec![Finding {
            line: None,
            why: format!(
                "This file hasn't changed in over {} days, but the repo has git activity within the last {} days.",
                STALE_AFTER_SECS / (24 * 60 * 60),
                RECENT_ACTIVITY_SECS / (24 * 60 * 60)
            ),
            fix: None,
        }]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    const DAY: i64 = 24 * 60 * 60;

    fn now() -> i64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64
    }

    #[test]
    fn flags_stale_file_in_active_repo() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir_all(dir.path().join(".git")).unwrap();
        fs::write(dir.path().join(".git/HEAD"), "ref: refs/heads/main").unwrap(); // fresh mtime

        let ctx = RuleContext {
            content: "stale instructions",
            file_path: None,
            repo_root: Some(dir.path()),
            resolution_root: Some(dir.path()),
            modified_unix: Some(now() - 200 * DAY),
        };
        assert_eq!(StaleVsChurn.check_ctx(&ctx).len(), 1);
    }

    #[test]
    fn accepts_recently_updated_file() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir_all(dir.path().join(".git")).unwrap();
        fs::write(dir.path().join(".git/HEAD"), "ref: refs/heads/main").unwrap();

        let ctx = RuleContext {
            content: "fresh instructions",
            file_path: None,
            repo_root: Some(dir.path()),
            resolution_root: Some(dir.path()),
            modified_unix: Some(now() - 10 * DAY),
        };
        assert!(StaleVsChurn.check_ctx(&ctx).is_empty());
    }

    #[test]
    fn does_not_fire_without_git_dir() {
        let dir = tempfile::tempdir().unwrap();
        let ctx = RuleContext {
            content: "stale instructions",
            file_path: None,
            repo_root: Some(dir.path()),
            resolution_root: Some(dir.path()),
            modified_unix: Some(now() - 200 * DAY),
        };
        assert!(StaleVsChurn.check_ctx(&ctx).is_empty());
    }

    #[test]
    fn does_not_fire_without_mtime() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir_all(dir.path().join(".git")).unwrap();
        fs::write(dir.path().join(".git/HEAD"), "ref: refs/heads/main").unwrap();

        let ctx = RuleContext {
            content: "stale instructions",
            file_path: None,
            repo_root: Some(dir.path()),
            resolution_root: Some(dir.path()),
            modified_unix: None,
        };
        assert!(StaleVsChurn.check_ctx(&ctx).is_empty());
    }
}
