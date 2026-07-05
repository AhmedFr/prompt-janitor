//! Scan orchestration: walk → grade → persist.

use std::collections::HashMap;
use std::path::Path;

use rusqlite::{params, Connection};

use crate::engine::{
    evaluate_ctx, grade_for_score, score_for_issues, Grade, RuleContext, Severity,
};
use crate::repo_root::find_repo_root;
use crate::scanner;

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

fn now_epoch() -> String {
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

    // Full rescan: clear prior results (grade history is kept).
    conn.execute_batch("DELETE FROM issues; DELETE FROM files; DELETE FROM projects;")?;

    let mut project_scores: HashMap<String, Vec<u32>> = HashMap::new();
    let (mut critical, mut warnings, mut nits) = (0u32, 0u32, 0u32);

    for (i, file) in files.iter().enumerate() {
        let file_path = Path::new(&file.path);
        let repo_root = find_repo_root(file_path);
        let ctx = RuleContext {
            content: &file.content,
            file_path: Some(file_path),
            repo_root: repo_root.as_deref(),
            modified_unix: file.modified_unix,
        };
        let mut issues = evaluate_ctx(&ctx, &rules).issues;
        issues.extend(crate::query::custom_issues(conn, &file.content));
        let score = score_for_issues(&issues);
        let grade = grade_for_score(score);
        let project = project_name(Path::new(&file.path));

        conn.execute(
            "INSERT OR IGNORE INTO projects(id, name, root_path) VALUES(?1, ?1, ?2)",
            params![project, root_str],
        )?;
        conn.execute(
            "INSERT OR REPLACE INTO files(id, project_id, path, kind, grade, score, issue_count, modified_at)
             VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                file.path,
                project,
                file.path,
                file.kind,
                grade.letter(),
                score as i64,
                issues.len() as i64,
                file.modified_unix.map(|m| m.to_string()),
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
            match issue.severity {
                Severity::Hi => critical += 1,
                Severity::Mid => warnings += 1,
                Severity::Lo => nits += 1,
            }
        }
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

    const FOCAL: &str = "\
# API Worker assistant

You are an assistant.
Always use gpt-4 for completions.
Be concise but also very thorough and detailed.

[no examples provided]
";

    const CLEAN: &str = "\
You are a senior Rust reviewer for the service.
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
