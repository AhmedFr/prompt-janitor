//! Scan orchestration: walk → grade → persist.

use std::collections::HashMap;
use std::path::Path;

use rusqlite::{params, Connection};
use sha2::{Digest, Sha256};

use crate::engine::{
    evaluate_ctx, grade_for_score, score_for_counts, Fix, Grade, Issue, RuleContext, Severity,
};
use crate::query::{severity_from_db, source_from_db};
use crate::repo_root::{find_repo_root, resolution_root};
use crate::scanner;

/// A stable content fingerprint used to detect whether a file changed since
/// its NL-standards issues were last recorded (#85). Not a security
/// primitive — just a cheap, collision-resistant-enough change detector.
fn content_hash(content: &str) -> String {
    let digest = Sha256::digest(content.as_bytes());
    digest.iter().map(|b| format!("{b:02x}")).collect()
}

/// Every NL-sourced issue currently persisted for a file, keyed by file id
/// (path), plus each file's last-recorded content hash. Snapshotted before
/// the full-rescan wipe so unchanged files can carry their AI-standards
/// verdicts forward instead of losing them (#85).
struct PriorNlState {
    hashes: HashMap<String, String>,
    issues: HashMap<String, Vec<Issue>>,
}

fn snapshot_prior_nl_state(conn: &Connection) -> rusqlite::Result<PriorNlState> {
    let mut hashes = HashMap::new();
    {
        let mut stmt =
            conn.prepare("SELECT id, content_hash FROM files WHERE content_hash IS NOT NULL")?;
        let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
        for row in rows {
            let (id, hash) = row?;
            hashes.insert(id, hash);
        }
    }

    let mut issues: HashMap<String, Vec<Issue>> = HashMap::new();
    {
        let mut stmt = conn.prepare(
            "SELECT file_id, rule_id, line, severity, source, title, why, fix_from, fix_to
             FROM issues WHERE rule_id IS NOT NULL",
        )?;
        let rows = stmt.query_map([], |r| {
            let file_id: String = r.get(0)?;
            let rule_id: String = r.get(1)?;
            let line: Option<i64> = r.get(2)?;
            let severity: String = r.get(3)?;
            let source: String = r.get(4)?;
            let title: String = r.get(5)?;
            let why: String = r.get(6)?;
            let fix_from: Option<String> = r.get(7)?;
            let fix_to: Option<String> = r.get(8)?;
            Ok((
                file_id, rule_id, line, severity, source, title, why, fix_from, fix_to,
            ))
        })?;
        for row in rows {
            let (file_id, rule_id, line, severity, source, title, why, fix_from, fix_to) = row?;
            let fix = match (fix_from, fix_to) {
                (Some(from), Some(to)) => Some(Fix { from, to }),
                _ => None,
            };
            issues.entry(file_id).or_default().push(Issue {
                rule_id,
                severity: severity_from_db(&severity),
                source: source_from_db(&source),
                title,
                why,
                line: line.map(|l| l as u32),
                fix,
            });
        }
    }

    Ok(PriorNlState { hashes, issues })
}

/// Per-scan memo of repo-root / resolution-root lookups, keyed by the
/// file's parent directory. Every file scan does a handful of `stat` calls
/// to find its roots; a project with many prompt files in the same
/// directory (or the same monorepo package) would otherwise redo that walk
/// once per file.
#[derive(Default)]
struct RootCache {
    repo_root: HashMap<std::path::PathBuf, Option<std::path::PathBuf>>,
    resolution_root: HashMap<std::path::PathBuf, Option<std::path::PathBuf>>,
}

impl RootCache {
    fn repo_root_for(&mut self, file_path: &Path) -> Option<std::path::PathBuf> {
        let parent = file_path.parent()?;
        self.repo_root
            .entry(parent.to_path_buf())
            .or_insert_with(|| find_repo_root(file_path))
            .clone()
    }

    fn resolution_root_for(&mut self, file_path: &Path) -> Option<std::path::PathBuf> {
        let parent = file_path.parent()?;
        self.resolution_root
            .entry(parent.to_path_buf())
            .or_insert_with(|| resolution_root(file_path))
            .clone()
    }
}

/// Summary of a completed scan, returned to the frontend.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct ScanSummary {
    pub files_scanned: u32,
    pub projects: u32,
    pub critical: u32,
    pub warnings: u32,
    pub nits: u32,
    pub overall_score: u32,
    pub overall_grade: Grade,
}

/// Seconds-since-epoch timestamp string, used for every `recorded_at` /
/// `started_at` column. Shared with `query::apply_nl_verdicts`, which writes
/// to the same `grade_history` table.
pub(crate) fn now_epoch() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

/// Project = the name of the immediate folder containing the file
/// (e.g. `~/code/.../homestop-testground/AGENTS.md` → `homestop-testground`).
fn project_name(path: &Path) -> String {
    path.parent()
        .and_then(|p| p.file_name())
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "root".to_string())
}

/// Walk `root`, grade every prompt file, and persist the results. Calls
/// `on_progress(done, total)` after each file. Returns a summary.
pub fn run_scan(
    conn: &Connection,
    root: &Path,
    mut on_progress: impl FnMut(u32, u32),
) -> rusqlite::Result<ScanSummary> {
    let files = scanner::scan_folder(root);
    let total = files.len() as u32;
    let rules = crate::query::active_rules(conn);
    let now = now_epoch();
    let root_str = root.display().to_string();

    // Snapshot NL-sourced issues + content hashes before the wipe below, so a
    // file whose content is unchanged can carry its AI-standards verdicts
    // forward (#85) instead of losing them on every rescan.
    let prior = snapshot_prior_nl_state(conn)?;

    // Full rescan: clear prior results (grade history is kept).
    conn.execute_batch("DELETE FROM issues; DELETE FROM files; DELETE FROM projects;")?;

    let mut project_scores: HashMap<String, Vec<u32>> = HashMap::new();
    let (mut critical, mut warnings, mut nits) = (0u32, 0u32, 0u32);
    let mut roots = RootCache::default();

    for (i, file) in files.iter().enumerate() {
        let file_path = Path::new(&file.path);
        let repo_root = roots.repo_root_for(file_path);
        let resolution_root = roots.resolution_root_for(file_path);
        let ctx = RuleContext {
            content: &file.content,
            file_path: Some(file_path),
            repo_root: repo_root.as_deref(),
            resolution_root: resolution_root.as_deref(),
            modified_unix: file.modified_unix,
        };
        let mut issues = evaluate_ctx(&ctx, &rules).issues;
        issues.extend(crate::query::custom_issues(conn, &file.content));

        // Content-hash comparison: only an unchanged file carries its prior
        // NL-standards issues forward. A changed (or brand-new) file starts
        // with a clean AI-standards slate — stale AI judgments must not
        // survive edits.
        let hash = content_hash(&file.content);
        let carried_nl: Vec<Issue> = match prior.hashes.get(&file.path) {
            Some(prev_hash) if prev_hash == &hash => {
                prior.issues.get(&file.path).cloned().unwrap_or_default()
            }
            _ => Vec::new(),
        };

        let (mut hi, mut mid, mut lo) = (0u32, 0u32, 0u32);
        for issue in issues.iter().chain(carried_nl.iter()) {
            match issue.severity {
                Severity::Hi => hi += 1,
                Severity::Mid => mid += 1,
                Severity::Lo => lo += 1,
            }
        }
        let score = score_for_counts(hi, mid, lo);
        let grade = grade_for_score(score);
        let project = project_name(Path::new(&file.path));
        let issue_count = issues.len() + carried_nl.len();

        conn.execute(
            "INSERT OR IGNORE INTO projects(id, name, root_path) VALUES(?1, ?1, ?2)",
            params![project, root_str],
        )?;
        conn.execute(
            "INSERT OR REPLACE INTO files(id, project_id, path, kind, grade, score, issue_count, modified_at, content_hash)
             VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                file.path,
                project,
                file.path,
                file.kind,
                grade.letter(),
                score as i64,
                issue_count as i64,
                file.modified_unix.map(|m| m.to_string()),
                hash,
            ],
        )?;
        for issue in &issues {
            conn.execute(
                "INSERT INTO issues(file_id, line, severity, source, title, why, fix_from, fix_to)
                 VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    file.path,
                    issue.line.map(|l| l as i64),
                    issue.severity.as_str(),
                    issue.source.as_str(),
                    issue.title,
                    issue.why,
                    issue.fix.as_ref().map(|f| f.from.as_str()),
                    issue.fix.as_ref().map(|f| f.to.as_str()),
                ],
            )?;
        }
        for issue in &carried_nl {
            conn.execute(
                "INSERT INTO issues(file_id, rule_id, line, severity, source, title, why, fix_from, fix_to)
                 VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    file.path,
                    issue.rule_id,
                    issue.line.map(|l| l as i64),
                    issue.severity.as_str(),
                    issue.source.as_str(),
                    issue.title,
                    issue.why,
                    issue.fix.as_ref().map(|f| f.from.as_str()),
                    issue.fix.as_ref().map(|f| f.to.as_str()),
                ],
            )?;
        }
        critical += hi;
        warnings += mid;
        nits += lo;
        conn.execute(
            "INSERT INTO grade_history(scope, scope_id, score, recorded_at) VALUES('file', ?1, ?2, ?3)",
            params![file.path, score as i64, now],
        )?;
        project_scores.entry(project).or_default().push(score);
        on_progress(i as u32 + 1, total);
    }

    // Roll up project + overall scores.
    let mut all_scores: Vec<u32> = Vec::new();
    for (project, scores) in &project_scores {
        let avg = scores.iter().sum::<u32>() / scores.len() as u32;
        let grade = grade_for_score(avg);
        conn.execute(
            "UPDATE projects SET score = ?1, grade = ?2 WHERE id = ?3",
            params![avg as i64, grade.letter(), project.as_str()],
        )?;
        all_scores.extend(scores.iter().copied());
    }
    let overall_score = if all_scores.is_empty() {
        100
    } else {
        all_scores.iter().sum::<u32>() / all_scores.len() as u32
    };
    let overall_grade = grade_for_score(overall_score);

    conn.execute(
        "INSERT INTO grade_history(scope, scope_id, score, recorded_at) VALUES('overall', 'overall', ?1, ?2)",
        params![overall_score as i64, now],
    )?;
    conn.execute(
        "INSERT INTO scans(started_at, finished_at, files_scanned) VALUES(?1, ?1, ?2)",
        params![now, total as i64],
    )?;

    Ok(ScanSummary {
        files_scanned: total,
        projects: project_scores.len() as u32,
        critical,
        warnings,
        nits,
        overall_score,
        overall_grade,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    // #74 narrowed the model rule to clearly-deprecated ids only, so this
    // fixture names a retired model (claude-2) to keep the 5-issue count.
    const FOCAL: &str = "\
# API Worker assistant

You are an assistant.
Always use claude-2 for completions.
Be concise but also very thorough and detailed.

[no examples provided]
";

    const CLEAN: &str = "\
You are a senior Rust reviewer for the service.
Focus on correctness, idiomatic ownership, and clear error handling.
Respond in JSON.
For example:
```
{}
```
";

    #[test]
    fn run_scan_persists_graded_files() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();

        let dir = tempfile::tempdir().unwrap();
        fs::create_dir_all(dir.path().join("api-worker")).unwrap();
        fs::write(dir.path().join("api-worker/CLAUDE.md"), FOCAL).unwrap();
        fs::create_dir_all(dir.path().join("web-app")).unwrap();
        fs::write(dir.path().join("web-app/AGENTS.md"), CLEAN).unwrap();

        let summary = run_scan(&conn, dir.path(), |_, _| {}).unwrap();
        assert_eq!(summary.files_scanned, 2);
        assert_eq!(summary.projects, 2);

        let files: i64 = conn
            .query_row("SELECT COUNT(*) FROM files", [], |r| r.get(0))
            .unwrap();
        assert_eq!(files, 2);

        let focal_grade: String = conn
            .query_row(
                "SELECT grade FROM files WHERE project_id = 'api-worker'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(focal_grade, "D");

        let focal_issues: i64 = conn
            .query_row(
                "SELECT issue_count FROM files WHERE project_id = 'api-worker'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(focal_issues, 5);

        let clean_grade: String = conn
            .query_row(
                "SELECT grade FROM files WHERE project_id = 'web-app'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(clean_grade, "A");

        // 2 file-scope + 1 overall history rows.
        let history: i64 = conn
            .query_row("SELECT COUNT(*) FROM grade_history", [], |r| r.get(0))
            .unwrap();
        assert_eq!(history, 3);
    }

    #[test]
    fn progress_is_reported() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("CLAUDE.md"), FOCAL).unwrap();

        let mut last = (0u32, 0u32);
        run_scan(&conn, dir.path(), |done, total| last = (done, total)).unwrap();
        assert_eq!(last, (1, 1));
    }

    fn clarity_verdict(violates: bool) -> crate::ai_rules::NlVerdict {
        crate::ai_rules::NlVerdict {
            rule_id: "anthropic-clarity".into(),
            title: "Vague directives".into(),
            severity: "mid".into(),
            source: "anthropic".into(),
            violates,
            explanation: "Too vague.".into(),
        }
    }

    #[test]
    fn rescan_preserves_nl_issues_when_content_unchanged() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("CLAUDE.md");
        fs::write(&file, CLEAN).unwrap();
        let file_id = file.display().to_string();

        run_scan(&conn, dir.path(), |_, _| {}).unwrap();
        let (baseline_score, baseline_issues): (i64, i64) = conn
            .query_row(
                "SELECT score, issue_count FROM files WHERE id = ?1",
                [&file_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();

        let verdicts = vec![clarity_verdict(true)];
        let (nl_score, _) = crate::query::apply_nl_verdicts(&conn, &file_id, &verdicts).unwrap();
        assert!(
            (nl_score as i64) < baseline_score,
            "an NL violation must lower the score"
        );

        // Rescan the same, unchanged content — the NL issue must survive and
        // the score must reflect the union of deterministic + NL issues, not
        // revert to the deterministic-only baseline.
        run_scan(&conn, dir.path(), |_, _| {}).unwrap();

        let (score, issue_count): (i64, i64) = conn
            .query_row(
                "SELECT score, issue_count FROM files WHERE id = ?1",
                [&file_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(
            score, nl_score as i64,
            "score must carry the NL issue forward across an unchanged rescan"
        );
        assert_eq!(issue_count, baseline_issues + 1);

        let rule_id: Option<String> = conn
            .query_row(
                "SELECT rule_id FROM issues WHERE file_id = ?1 AND rule_id IS NOT NULL",
                [&file_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(rule_id.as_deref(), Some("anthropic-clarity"));
    }

    #[test]
    fn rescan_drops_nl_issues_when_content_changed() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("CLAUDE.md");
        fs::write(&file, CLEAN).unwrap();
        let file_id = file.display().to_string();

        run_scan(&conn, dir.path(), |_, _| {}).unwrap();
        let verdicts = vec![clarity_verdict(true)];
        crate::query::apply_nl_verdicts(&conn, &file_id, &verdicts).unwrap();

        let nl_issues_before: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM issues WHERE file_id = ?1 AND rule_id IS NOT NULL",
                [&file_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(nl_issues_before, 1);

        // Edit the file — the content hash changes, so the stale AI judgment
        // must not survive.
        fs::write(
            &file,
            format!("{CLEAN}\nOne more sentence changes the hash.\n"),
        )
        .unwrap();
        run_scan(&conn, dir.path(), |_, _| {}).unwrap();

        let nl_issues_after: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM issues WHERE file_id = ?1 AND rule_id IS NOT NULL",
                [&file_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(
            nl_issues_after, 0,
            "an NL issue must not survive a content change"
        );
    }

    #[test]
    fn project_is_the_immediate_parent_folder() {
        assert_eq!(
            project_name(Path::new(
                "/Users/x/code/02-personal/homestop/homestop-testground/AGENTS.md"
            )),
            "homestop-testground"
        );
        assert_eq!(
            project_name(Path::new("/Users/x/code/web-app/CLAUDE.md")),
            "web-app"
        );
    }
}
