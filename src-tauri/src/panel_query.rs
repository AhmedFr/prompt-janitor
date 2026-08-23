//! The menu-bar panel's read model.
//!
//! The popover answers one question — "is my setup good enough right now?" —
//! in a single round trip, so this module composes reads that already exist
//! rather than adding tables or duplicating their rules:
//!
//! * the verdict comes straight from [`crate::query::get_overview`], so the
//!   panel and the Overview screen can never disagree about the grade;
//! * the "erroring" cutoff is [`ERROR_RATE_THRESHOLD`], the same number the
//!   project list warns on;
//! * days are UTC calendar days from [`window_calendar_days`], matching
//!   `project_usage`'s session buckets;
//! * sessions are counted top-level only (`parent_session_id IS NULL`) —
//!   a sub-agent transcript is not a session the user started.
//!
//! Nothing here writes.

use rusqlite::Connection;

use crate::engine::Grade;
use crate::harness::time::iso_from_epoch;
use crate::harness_query::{last_component, window_calendar_days, ERROR_RATE_THRESHOLD};
use crate::query::{get_overview, grade_from_db};

/// One row of the panel's "fix these next" list.
#[derive(Debug, Clone, PartialEq, serde::Serialize, specta::Type)]
pub struct PanelFix {
    /// `files.id` — the absolute path, which is also the detail route's target.
    pub file_id: String,
    /// File basename, all the width the panel has.
    pub name: String,
    pub project_name: String,
    pub grade: Grade,
    pub issue_count: u32,
}

/// Everything the menu-bar panel renders in one payload.
///
/// Scan state is deliberately absent: the panel subscribes to the
/// `scan-phase` / `scan-progress` / `scan-done` events like the Setup screen
/// does, and refetches this snapshot when a scan finishes.
#[derive(Debug, Clone, PartialEq, serde::Serialize, specta::Type)]
pub struct PanelSnapshot {
    /// False before the first scan — the panel shows "No scan yet" instead of
    /// a verdict that would read as a perfect score.
    pub has_data: bool,
    pub overall_grade: Grade,
    pub overall_score: u32,
    /// Change across the trend window (latest − earliest), from `get_overview`.
    pub delta: i32,
    /// Newest of the harness and file scans, as RFC3339 — the shape every
    /// other `last_scan_at` on the frontend is formatted from.
    pub last_scan_at: Option<String>,
    /// At most three files, worst grade first then most issues.
    pub top_fixes: Vec<PanelFix>,
    /// Skills, any layer, that no invocation has ever resolved to.
    pub never_used_skills: u32,
    /// MCP servers whose rollup is at or above [`ERROR_RATE_THRESHOLD`].
    pub mcp_erroring: u32,
    /// Top-level sessions started since UTC midnight of `now_epoch_secs`.
    pub sessions_today: u32,
}

/// How many fixes the panel has room for.
const TOP_FIXES: usize = 3;

fn as_u32(v: i64) -> u32 {
    v.clamp(0, u32::MAX as i64) as u32
}

/// Newest of `harnesses.last_scan_at` and `scans.finished_at`, rendered as
/// RFC3339.
///
/// Both columns hold epoch seconds as text, so they are compared numerically
/// rather than lexicographically — a text `MAX()` across the two would start
/// lying the day the epoch gains a digit, and would rank an unparseable legacy
/// value above a real one.
fn last_scan_at(conn: &Connection) -> rusqlite::Result<Option<String>> {
    let newest = |sql: &str| -> rusqlite::Result<Option<i64>> {
        let raw: Option<String> = conn.query_row(sql, [], |r| r.get(0))?;
        Ok(raw.and_then(|s| s.parse::<i64>().ok()))
    };
    let harness = newest("SELECT MAX(last_scan_at) FROM harnesses")?;
    let files = newest("SELECT MAX(finished_at) FROM scans")?;
    Ok(harness.max(files).map(iso_from_epoch))
}

/// The files the panel offers to fix: worst grade first, then the most issues.
///
/// A missing `grade` reads as `F`, the same way [`grade_from_db`] treats it —
/// an ungraded file is not a good file.
fn top_fixes(conn: &Connection) -> rusqlite::Result<Vec<PanelFix>> {
    let mut stmt = conn.prepare(
        "SELECT f.id, f.path, p.name, COALESCE(f.grade, 'F'), f.issue_count
           FROM files f JOIN projects p ON p.id = f.project_id
          ORDER BY CASE COALESCE(f.grade, 'F')
                     WHEN 'F' THEN 0 WHEN 'D' THEN 1 WHEN 'C' THEN 2 WHEN 'B' THEN 3 ELSE 4 END,
                   f.issue_count DESC, f.id
          LIMIT ?1",
    )?;
    let fixes = stmt
        .query_map([TOP_FIXES as i64], |r| {
            Ok(PanelFix {
                file_id: r.get(0)?,
                name: last_component(&r.get::<_, String>(1)?),
                project_name: r.get(2)?,
                grade: grade_from_db(&r.get::<_, String>(3)?),
                issue_count: as_u32(r.get::<_, i64>(4)?),
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(fixes)
}

/// Compose the panel payload. `now_epoch_secs` is the clock the "today"
/// boundary is taken from, injected so the read is testable.
pub fn panel_snapshot(conn: &Connection, now_epoch_secs: i64) -> rusqlite::Result<PanelSnapshot> {
    let overview = get_overview(conn)?;

    let never_used_skills: i64 = conn.query_row(
        "SELECT COUNT(*) FROM artifacts a
          WHERE a.kind = 'skill'
            AND NOT EXISTS (SELECT 1 FROM usage_stats u WHERE u.artifact_id = a.id)",
        [],
        |r| r.get(0),
    )?;
    let mcp_erroring: i64 = conn.query_row(
        &format!(
            "SELECT COUNT(*) FROM artifacts a
              WHERE a.kind = 'mcp_server'
                AND EXISTS (SELECT 1 FROM usage_stats u
                             WHERE u.artifact_id = a.id
                               AND u.error_rate >= {ERROR_RATE_THRESHOLD})"
        ),
        [],
        |r| r.get(0),
    )?;

    // `started_at` is a UTC RFC3339 stamp, so its first ten characters are the
    // UTC calendar day — matched rather than compared against a synthesized
    // midnight, because `>= '…T00:00:00Z'` would sort the millisecond form
    // (`…T00:00:00.000Z`) *below* the boundary and drop a session started on
    // the stroke of midnight.
    let today = window_calendar_days(now_epoch_secs, 1).remove(0);
    let sessions_today: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sessions
          WHERE parent_session_id IS NULL AND substr(started_at, 1, 10) = ?1",
        [today],
        |r| r.get(0),
    )?;

    Ok(PanelSnapshot {
        has_data: overview.has_data,
        overall_grade: overview.overall_grade,
        overall_score: overview.overall_score,
        delta: overview.trend_delta,
        last_scan_at: last_scan_at(conn)?,
        top_fixes: top_fixes(conn)?,
        never_used_skills: as_u32(never_used_skills),
        mcp_erroring: as_u32(mcp_erroring),
        sessions_today: as_u32(sessions_today),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::Grade;
    use crate::store::test_conn;
    use rusqlite::{params, Connection};

    /// 2026-08-02T12:00:00Z — midday, so "today" and "yesterday" are
    /// unambiguous either side of the UTC boundary the read model uses.
    const NOW: i64 = 1_785_672_000;

    fn project(conn: &Connection, id: &str, name: &str) {
        conn.execute(
            "INSERT INTO projects(id, name, root_path, grade, score) VALUES(?1, ?2, ?1, 'C', 70)",
            params![id, name],
        )
        .unwrap();
    }

    fn file(conn: &Connection, project_id: &str, path: &str, grade: &str, issues: i64) {
        conn.execute(
            "INSERT INTO files(id, project_id, path, kind, grade, score, issue_count, modified_at)
             VALUES(?1, ?2, ?1, 'rule', ?3, 60, ?4, '2026-08-01T00:00:00Z')",
            params![path, project_id, grade, issues],
        )
        .unwrap();
    }

    /// One artifact row; returns its rowid so a usage rollup can be linked.
    fn artifact(conn: &Connection, kind: &str, name: &str, layer: &str) -> i64 {
        conn.execute(
            "INSERT INTO artifacts(harness, layer, project_path, kind, name, path, bytes, hash, seen_at)
             VALUES('claude_code', ?1, NULL, ?2, ?3, ?3, 10, 'h', '2026-08-01T00:00:00Z')",
            params![layer, kind, name],
        )
        .unwrap();
        conn.last_insert_rowid()
    }

    fn usage(conn: &Connection, artifact_id: i64, kind: &str, target: &str, error_rate: f64) {
        conn.execute(
            "INSERT INTO usage_stats(harness, kind, target, artifact_id, total, sessions,
                                     last_used, error_rate, count_30d, count_prev_30d)
             VALUES('claude_code', ?1, ?2, ?3, 4, 2, '2026-08-01T00:00:00Z', ?4, 4, 0)",
            params![kind, target, artifact_id, error_rate],
        )
        .unwrap();
    }

    fn session(conn: &Connection, id: &str, started_at: &str) {
        conn.execute(
            "INSERT INTO sessions(id, harness, project_path, log_path, started_at)
             VALUES(?1, 'claude_code', '/code/app', ?1, ?2)",
            params![id, started_at],
        )
        .unwrap();
    }

    #[test]
    fn empty_db_reports_no_data_and_zero_signals() {
        let conn = test_conn();
        let s = panel_snapshot(&conn, NOW).unwrap();

        assert!(!s.has_data);
        assert_eq!(s.overall_grade, Grade::A);
        assert_eq!(s.overall_score, 100);
        assert_eq!(s.delta, 0);
        assert_eq!(s.last_scan_at, None);
        assert!(s.top_fixes.is_empty());
        assert_eq!(s.never_used_skills, 0);
        assert_eq!(s.mcp_erroring, 0);
        assert_eq!(s.sessions_today, 0);
    }

    #[test]
    fn top_fixes_are_worst_grade_first_then_most_issues() {
        let conn = test_conn();
        project(&conn, "/code/app", "app");
        project(&conn, "/code/api", "api");
        file(&conn, "/code/app", "/code/app/CLAUDE.md", "F", 3);
        file(&conn, "/code/app", "/code/app/AGENTS.md", "F", 7);
        file(&conn, "/code/api", "/code/api/CLAUDE.md", "D", 9);
        file(&conn, "/code/api", "/code/api/README.md", "A", 0);

        let s = panel_snapshot(&conn, NOW).unwrap();

        assert!(s.has_data);
        assert_eq!(
            s.top_fixes
                .iter()
                .map(|f| (
                    f.name.as_str(),
                    f.project_name.as_str(),
                    f.grade,
                    f.issue_count
                ))
                .collect::<Vec<_>>(),
            vec![
                ("AGENTS.md", "app", Grade::F, 7),
                ("CLAUDE.md", "app", Grade::F, 3),
                ("CLAUDE.md", "api", Grade::D, 9),
            ],
            "worst grade first, then most issues; capped at three"
        );
        assert_eq!(s.top_fixes[0].file_id, "/code/app/AGENTS.md");
    }

    #[test]
    fn never_used_skills_counts_skills_with_no_usage_row() {
        let conn = test_conn();
        let used = artifact(&conn, "skill", "adapt", "global");
        artifact(&conn, "skill", "unused-skill", "global");
        artifact(&conn, "skill", "project-skill", "project");
        // A never-invoked agent is not a skill, so it must not be counted.
        artifact(&conn, "agent", "unused-agent", "global");
        usage(&conn, used, "skill", "adapt", 0.0);

        let s = panel_snapshot(&conn, NOW).unwrap();

        assert_eq!(s.never_used_skills, 2, "both layers, skills only");
    }

    #[test]
    fn mcp_erroring_counts_at_or_above_the_shared_threshold() {
        let conn = test_conn();
        let noisy = artifact(&conn, "mcp_server", "noisy", "global");
        let borderline = artifact(&conn, "mcp_server", "borderline", "global");
        let quiet = artifact(&conn, "mcp_server", "quiet", "global");
        let skill = artifact(&conn, "skill", "loud-skill", "global");
        usage(&conn, noisy, "mcp", "noisy", 0.9);
        usage(&conn, borderline, "mcp", "borderline", 0.25);
        usage(&conn, quiet, "mcp", "quiet", 0.1);
        usage(&conn, skill, "skill", "loud-skill", 0.9);

        let s = panel_snapshot(&conn, NOW).unwrap();

        assert_eq!(s.mcp_erroring, 2, "0.25 is in, 0.1 is out, skills excluded");
    }

    #[test]
    fn sessions_today_counts_from_utc_midnight_and_top_level_only() {
        let conn = test_conn();
        session(&conn, "s-yesterday", "2026-08-01T23:59:59.000Z");
        session(&conn, "s-midnight", "2026-08-02T00:00:00.000Z");
        session(&conn, "s-now", "2026-08-02T11:00:00.000Z");
        conn.execute(
            "INSERT INTO sessions(id, harness, project_path, log_path, started_at, parent_session_id)
             VALUES('s-sub', 'claude_code', '/code/app', 's-sub', '2026-08-02T11:30:00.000Z', 's-now')",
            [],
        )
        .unwrap();

        let s = panel_snapshot(&conn, NOW).unwrap();

        assert_eq!(s.sessions_today, 2, "yesterday and sub-agents excluded");
    }

    #[test]
    fn last_scan_at_is_the_newest_of_the_harness_and_file_scans() {
        let conn = test_conn();
        // Both columns hold epoch seconds as text; the panel renders RFC3339.
        conn.execute(
            "INSERT INTO scans(started_at, finished_at, files_scanned) VALUES('1785628800', '1785628800', 1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO harnesses(id, display_name, detected, last_scan_at)
             VALUES('claude_code', 'Claude Code', 1, '1785672000')",
            [],
        )
        .unwrap();

        let s = panel_snapshot(&conn, NOW).unwrap();

        assert_eq!(s.last_scan_at.as_deref(), Some("2026-08-02T12:00:00.000Z"));
    }

    #[test]
    fn last_scan_at_falls_back_to_the_file_scan_alone() {
        let conn = test_conn();
        conn.execute(
            "INSERT INTO scans(started_at, finished_at, files_scanned) VALUES('1785628800', '1785628800', 1)",
            [],
        )
        .unwrap();

        let s = panel_snapshot(&conn, NOW).unwrap();

        assert_eq!(s.last_scan_at.as_deref(), Some("2026-08-02T00:00:00.000Z"));
    }
}
