//! Read-side queries that back the frontend screens.

use rusqlite::{params, Connection, OptionalExtension};

use crate::engine::{grade_for_score, Dimension, Grade, Rule, Severity, Source};
use crate::harness_query::ERROR_RATE_THRESHOLD;
use crate::rules::builtin_rules;

#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct WorklistItem {
    pub file_id: String,
    pub title: String,
    pub location: String,
    pub severity: Severity,
    pub source: Source,
    pub line: Option<u32>,
    /// Containing project (for the "By project" grouping).
    pub project: String,
    /// File last-modified epoch string (for the "Newest" grouping).
    pub modified: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct Overview {
    pub has_data: bool,
    pub scan_folder: Option<String>,
    pub overall_grade: Grade,
    pub overall_score: u32,
    pub file_count: u32,
    pub project_count: u32,
    pub critical: u32,
    pub warnings: u32,
    pub nits: u32,
    pub worklist: Vec<WorklistItem>,
    pub trend: Vec<u32>,
    /// Change across the trend window (latest − earliest).
    pub trend_delta: i32,
    /// Most recent scan finish time (epoch seconds string).
    pub last_scan: Option<String>,
}

/// One grade's share of `files_tracked`, always emitted for all five grades
/// (zero-filled) so the Analytics distribution chart never has to guess at
/// missing buckets.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct GradeCount {
    pub grade: Grade,
    pub count: u32,
}

/// One point on the Analytics overall-score trend line.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct TrendPoint {
    /// Epoch-seconds string (matches `grade_history.recorded_at`).
    pub t: String,
    pub score: u32,
}

/// One title from the "most common issues" leaderboard, with how many
/// distinct files it appears in.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct CommonIssue {
    pub title: String,
    pub files_affected: u32,
}

/// Everything the Analytics page needs in one round trip (#88 data-viz
/// epic). `issues_fixed_*` are lifetime totals (all of `fix_events`); every
/// other field is a live snapshot except `trend`, which is windowed to the
/// trailing `range_days`.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct Analytics {
    pub overall_score: u32,
    pub overall_grade: Grade,
    /// Latest overall-history score minus the earliest within the window
    /// (0 if the window has fewer than two points).
    pub overall_delta: i32,
    pub files_tracked: u32,
    pub project_count: u32,
    pub issues_fixed_total: u32,
    pub issues_fixed_auto: u32,
    pub issues_fixed_manual: u32,
    pub open_issues: u32,
    pub open_critical: u32,
    pub grade_distribution: Vec<GradeCount>,
    pub trend: Vec<TrendPoint>,
    pub common_issues: Vec<CommonIssue>,
}

/// Parse a persisted severity string. Shared with `scan::run_scan`, which
/// reconstructs prior NL issues from the `issues` table to carry them forward
/// across unchanged-content rescans (#85).
pub(crate) fn severity_from_db(s: &str) -> Severity {
    match s {
        "hi" => Severity::Hi,
        "lo" => Severity::Lo,
        _ => Severity::Mid,
    }
}

/// Parse a persisted source string. Shared with `scan::run_scan` (see
/// [`severity_from_db`]).
pub(crate) fn source_from_db(s: &str) -> Source {
    match s {
        "openai" => Source::Openai,
        "cursor" => Source::Cursor,
        "karpathy" => Source::Karpathy,
        "custom" => Source::Custom,
        _ => Source::Anthropic,
    }
}

/// Read a persisted setting.
pub fn get_setting(conn: &Connection, key: &str) -> rusqlite::Result<Option<String>> {
    conn.query_row("SELECT value FROM settings WHERE key = ?1", [key], |r| {
        r.get::<_, String>(0)
    })
    .optional()
}

/// Write a persisted setting.
pub fn set_setting(conn: &Connection, key: &str, value: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO settings(key, value) VALUES(?1, ?2)",
        params![key, value],
    )?;
    Ok(())
}

/// Folders the user added by hand, on top of what the harnesses report.
/// Stored as a JSON array of strings; a missing or malformed value reads as
/// empty. The single source of truth for that decoding — the scan, the
/// scheduler and the Overview all read it through here.
pub fn extra_scan_folders(conn: &Connection) -> Vec<String> {
    get_setting(conn, "extra_scan_folders")
        .ok()
        .flatten()
        .and_then(|s| serde_json::from_str::<Vec<String>>(&s).ok())
        .unwrap_or_default()
}

/// What the Overview labels as the scan's scope. A detected harness means the
/// scan already covers everything it knows about; otherwise the scope is
/// whatever folder the user added by hand (the first one, if several).
fn scan_scope_label(conn: &Connection) -> rusqlite::Result<Option<String>> {
    let detected: i64 = conn.query_row(
        "SELECT count(*) FROM harnesses WHERE detected = 1",
        [],
        |r| r.get(0),
    )?;
    if detected > 0 {
        return Ok(Some("everything".to_string()));
    }
    Ok(extra_scan_folders(conn).into_iter().next())
}

/// Everything the Overview screen needs.
pub fn get_overview(conn: &Connection) -> rusqlite::Result<Overview> {
    let scan_folder = scan_scope_label(conn)?;
    let last_scan = conn.query_row("SELECT MAX(finished_at) FROM scans", [], |r| {
        r.get::<_, Option<String>>(0)
    })?;
    let file_count =
        conn.query_row("SELECT COUNT(*) FROM files", [], |r| r.get::<_, i64>(0))? as u32;

    if file_count == 0 {
        return Ok(Overview {
            has_data: false,
            scan_folder,
            overall_grade: Grade::A,
            overall_score: 100,
            file_count: 0,
            project_count: 0,
            critical: 0,
            warnings: 0,
            nits: 0,
            worklist: Vec::new(),
            trend: Vec::new(),
            trend_delta: 0,
            last_scan,
        });
    }

    let project_count =
        conn.query_row("SELECT COUNT(*) FROM projects", [], |r| r.get::<_, i64>(0))? as u32;
    let count_sev = |sev: &str| -> rusqlite::Result<u32> {
        conn.query_row(
            "SELECT COUNT(*) FROM issues WHERE severity = ?1",
            [sev],
            |r| r.get::<_, i64>(0),
        )
        .map(|n| n as u32)
    };
    let critical = count_sev("hi")?;
    let warnings = count_sev("mid")?;
    let nits = count_sev("lo")?;

    let overall_score = conn.query_row("SELECT COALESCE(AVG(score), 100) FROM files", [], |r| {
        r.get::<_, f64>(0)
    })? as u32;

    let mut stmt = conn.prepare(
        "SELECT i.file_id, i.title, i.severity, i.source, i.line, f.project_id, f.kind, f.modified_at
         FROM issues i JOIN files f ON f.id = i.file_id
         ORDER BY CASE i.severity WHEN 'hi' THEN 0 WHEN 'mid' THEN 1 ELSE 2 END, f.project_id
         LIMIT 12",
    )?;
    let worklist = stmt
        .query_map([], |r| {
            let line: Option<i64> = r.get(4)?;
            let project: String = r.get(5)?;
            let kind: String = r.get(6)?;
            let modified: Option<String> = r.get(7)?;
            let location = match line {
                Some(l) => format!("{project} / {kind} · line {l}"),
                None => format!("{project} / {kind}"),
            };
            Ok(WorklistItem {
                file_id: r.get(0)?,
                title: r.get(1)?,
                severity: severity_from_db(&r.get::<_, String>(2)?),
                source: source_from_db(&r.get::<_, String>(3)?),
                line: line.map(|l| l as u32),
                project,
                modified,
                location,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    let mut trend_stmt = conn.prepare(
        "SELECT score FROM grade_history WHERE scope = 'overall' ORDER BY id DESC LIMIT 7",
    )?;
    let mut trend = trend_stmt
        .query_map([], |r| r.get::<_, i64>(0).map(|n| n as u32))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    trend.reverse();

    let trend_delta = if trend.len() >= 2 {
        trend[trend.len() - 1] as i32 - trend[0] as i32
    } else {
        0
    };

    Ok(Overview {
        has_data: true,
        scan_folder,
        overall_grade: grade_for_score(overall_score),
        overall_score,
        file_count,
        project_count,
        critical,
        warnings,
        nits,
        worklist,
        trend,
        trend_delta,
        last_scan,
    })
}

pub(crate) fn grade_from_db(s: &str) -> Grade {
    match s {
        "A" => Grade::A,
        "B" => Grade::B,
        "C" => Grade::C,
        "D" => Grade::D,
        _ => Grade::F,
    }
}

/// A row in the Prompts table.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct FileRow {
    pub id: String,
    pub name: String,
    /// Absolute path on disk — lets the frontend match a freshly-written file
    /// (e.g. an applied template) to its scanned id after a rescan.
    pub path: String,
    pub project: String,
    /// Owning project's id (its absolute repo-root path) — used to group
    /// files without colliding same-named projects.
    pub project_id: String,
    /// File classification (e.g. `CLAUDE.md`, `AGENTS.md`, `.cursorrules`) —
    /// drives the provider icon in the UI.
    pub kind: String,
    pub grade: Grade,
    pub score: u32,
    pub issue_count: u32,
    pub modified: Option<String>,
}

/// All scanned files, best grade first.
pub fn list_files(conn: &Connection) -> rusqlite::Result<Vec<FileRow>> {
    let mut stmt = conn.prepare(
        "SELECT f.id, f.path, f.kind, p.name, f.grade, f.score, f.issue_count, f.modified_at,
                rtrim(f.project_id, '/')
         FROM files f JOIN projects p ON p.id = f.project_id
         ORDER BY CASE f.grade WHEN 'A' THEN 0 WHEN 'B' THEN 1 WHEN 'C' THEN 2 WHEN 'D' THEN 3 ELSE 4 END,
                  p.name, f.kind",
    )?;
    let rows = stmt
        .query_map([], |r| {
            let path: String = r.get(1)?;
            let kind: String = r.get(2)?;
            let name = std::path::Path::new(&path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(kind.as_str())
                .to_string();
            Ok(FileRow {
                id: r.get(0)?,
                name,
                path: path.clone(),
                project: r.get(3)?,
                kind,
                grade: grade_from_db(&r.get::<_, String>(4)?),
                score: r.get::<_, i64>(5)? as u32,
                issue_count: r.get::<_, i64>(6)? as u32,
                modified: r.get::<_, Option<String>>(7)?,
                project_id: r.get(8)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

/// A project rollup for the sidebar and the Prompts group headers.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct ProjectRow {
    pub id: String,
    pub name: String,
    pub grade: Grade,
    pub score: u32,
    pub file_count: u32,
    pub issue_count: u32,
    /// Base64 `data:` URI of the project's logo, if one was detected.
    pub logo: Option<String>,
    /// Most recent file mtime in the project (epoch seconds string).
    pub modified: Option<String>,
    /// The harness that has worked here most, when any has.
    pub harness: Option<String>,
    /// Top-level sessions that harness has run here (all time).
    pub session_count: u32,
    pub last_session_at: Option<String>,
    /// Invocable artifacts configured in the project (skill/agent/command/
    /// mcp_server) that nothing has ever invoked.
    pub never_used_count: u32,
    /// Those of them whose rollup says at least a quarter of their calls
    /// errored.
    pub error_count: u32,
    /// False only when a harness has seen the directory and it is gone from
    /// disk — a project no harness knows about is assumed to be there.
    pub exists: bool,
}

/// The project-layer artifacts a user can actually invoke. A rule or a
/// settings file is configuration, not a habit, so neither can be "unused".
const INVOCABLE_KINDS: &str = "('skill', 'agent', 'command', 'mcp_server')";

/// Every project with its rolled-up file/issue counts, worst-grade first,
/// plus what the harness scan knows about the same directory.
///
/// The harness facts are joined in through one row per path: a directory can
/// be a project of several harnesses, and joining them all in would multiply
/// the file rollup. The busiest harness's row wins — SQLite fills the bare
/// columns of a `max()` group from the row that matched.
///
/// Every join onto a harness-recorded directory path goes through
/// `rtrim(p.id, '/')`, and so does the `id` this hands back: `resolve_project`
/// mints a separator-free id, but a database written before that fix still
/// holds `/code/app/` rows, and one stray separator would silently blank the
/// harness columns — and follow the reader into the project page, whose own
/// reads are keyed by this id.
pub fn list_projects(conn: &Connection) -> rusqlite::Result<Vec<ProjectRow>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT rtrim(p.id, '/'), p.name, p.grade, p.score, p.logo,
                COUNT(f.id), COALESCE(SUM(f.issue_count), 0), MAX(f.modified_at),
                hp.harness, COALESCE(hp.session_count, 0), hp.last_session_at,
                COALESCE(hp.exists_on_disk, 1),
                (SELECT COUNT(*) FROM artifacts a
                  WHERE a.project_path = rtrim(p.id, '/') AND a.layer = 'project'
                    AND a.kind IN {INVOCABLE_KINDS}
                    AND NOT EXISTS (SELECT 1 FROM usage_stats u
                                     WHERE u.artifact_id = a.id)),
                (SELECT COUNT(*) FROM artifacts a
                  WHERE a.project_path = rtrim(p.id, '/') AND a.layer = 'project'
                    AND a.kind IN {INVOCABLE_KINDS}
                    AND EXISTS (SELECT 1 FROM usage_stats u
                                 WHERE u.artifact_id = a.id
                                   AND u.error_rate >= {ERROR_RATE_THRESHOLD}))
         FROM projects p
         LEFT JOIN files f ON f.project_id = p.id
         LEFT JOIN (SELECT path, harness, exists_on_disk, last_session_at,
                           max(session_count) AS session_count
                      FROM harness_projects GROUP BY path) hp ON hp.path = rtrim(p.id, '/')
         GROUP BY p.id
         ORDER BY CASE p.grade WHEN 'A' THEN 0 WHEN 'B' THEN 1 WHEN 'C' THEN 2 WHEN 'D' THEN 3 ELSE 4 END,
                  MAX(f.modified_at) DESC"
    ))?;
    let rows = stmt
        .query_map([], |r| {
            Ok(ProjectRow {
                id: r.get(0)?,
                name: r.get(1)?,
                grade: grade_from_db(&r.get::<_, Option<String>>(2)?.unwrap_or_else(|| "F".into())),
                score: r.get::<_, Option<i64>>(3)?.unwrap_or(0) as u32,
                logo: r.get(4)?,
                file_count: r.get::<_, i64>(5)? as u32,
                issue_count: r.get::<_, i64>(6)? as u32,
                modified: r.get::<_, Option<String>>(7)?,
                harness: r.get(8)?,
                session_count: r.get::<_, i64>(9)?.max(0) as u32,
                last_session_at: r.get(10)?,
                exists: r.get::<_, i64>(11)? != 0,
                never_used_count: r.get::<_, i64>(12)?.max(0) as u32,
                error_count: r.get::<_, i64>(13)?.max(0) as u32,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

/// One issue in the Detail view.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct IssueDetail {
    pub line: Option<u32>,
    pub severity: Severity,
    pub source: Source,
    pub title: String,
    pub why: String,
    pub fix_from: Option<String>,
    pub fix_to: Option<String>,
}

/// One dimension's rolled-up score for a file (drives the radar chart, #88).
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct DimensionScore {
    pub dimension: String,
    pub score: u32,
}

/// Everything the Detail screen needs for one file.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct FileDetail {
    pub id: String,
    pub name: String,
    pub project: String,
    pub path: String,
    pub grade: Grade,
    pub score: u32,
    pub content: String,
    pub issues: Vec<IssueDetail>,
    /// Score change since the previous scan of this file, if any.
    pub delta: Option<i32>,
    /// Per-dimension scores, always length 5 in `Dimension::ALL` order.
    pub dimensions: Vec<DimensionScore>,
}

/// Load a single file with its current source + issues. `None` if unknown.
pub fn get_file_detail(conn: &Connection, file_id: &str) -> rusqlite::Result<Option<FileDetail>> {
    let row = conn
        .query_row(
            "SELECT id, path, kind, project_id, grade, score FROM files WHERE id = ?1",
            [file_id],
            |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, String>(3)?,
                    r.get::<_, String>(4)?,
                    r.get::<_, i64>(5)?,
                ))
            },
        )
        .optional()?;

    let Some((id, path, kind, project, grade, score)) = row else {
        return Ok(None);
    };

    let content = std::fs::read_to_string(&path).unwrap_or_default();
    let name = std::path::Path::new(&path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(kind.as_str())
        .to_string();

    let mut stmt = conn.prepare(
        "SELECT line, severity, source, title, why, fix_from, fix_to, dimension FROM issues WHERE file_id = ?1
         ORDER BY CASE severity WHEN 'hi' THEN 0 WHEN 'mid' THEN 1 ELSE 2 END, COALESCE(line, 1000000)",
    )?;
    let issue_rows = stmt
        .query_map([file_id], |r| {
            let line: Option<i64> = r.get(0)?;
            let severity: String = r.get(1)?;
            let dimension: Option<String> = r.get(7)?;
            Ok((
                IssueDetail {
                    line: line.map(|l| l as u32),
                    severity: severity_from_db(&severity),
                    source: source_from_db(&r.get::<_, String>(2)?),
                    title: r.get(3)?,
                    why: r.get(4)?,
                    fix_from: r.get(5)?,
                    fix_to: r.get(6)?,
                },
                severity,
                dimension,
            ))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    let dimensions = Dimension::ALL
        .iter()
        .map(|d| {
            let (mut hi, mut mid, mut lo) = (0u32, 0u32, 0u32);
            for (_, severity, dimension) in &issue_rows {
                let row_dim = Dimension::from_db(dimension.as_deref().unwrap_or(""));
                if row_dim != *d {
                    continue;
                }
                match severity.as_str() {
                    "hi" => hi += 1,
                    "mid" => mid += 1,
                    _ => lo += 1,
                }
            }
            DimensionScore {
                dimension: d.as_str().into(),
                score: crate::engine::score_for_counts(hi, mid, lo),
            }
        })
        .collect::<Vec<_>>();

    let issues = issue_rows.into_iter().map(|(issue, _, _)| issue).collect();

    let delta = {
        let mut hist = conn.prepare(
            "SELECT score FROM grade_history WHERE scope = 'file' AND scope_id = ?1 ORDER BY id DESC LIMIT 2",
        )?;
        let scores: Vec<i64> = hist
            .query_map([&path], |r| r.get::<_, i64>(0))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        if scores.len() == 2 {
            Some((scores[0] - scores[1]) as i32)
        } else {
            None
        }
    };

    Ok(Some(FileDetail {
        id,
        name,
        project,
        path,
        grade: grade_from_db(&grade),
        score: score as u32,
        content,
        issues,
        delta,
        dimensions,
    }))
}

/// An item in the digest's "needs your eyes" list.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct DigestItem {
    /// "regressed" | "improved" | "new".
    pub kind: String,
    pub file_id: String,
    pub title: String,
    pub detail: String,
}

/// The weekly Scans digest.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct ScansDigest {
    pub has_data: bool,
    pub overall_grade: Grade,
    pub net_health: i32,
    pub improved: u32,
    pub regressed: u32,
    pub scan_count: u32,
    pub trend: Vec<u32>,
    pub needs_attention: Vec<DigestItem>,
    /// Log lines the latest scan's harness pass could not parse, summed over
    /// every harness that reported. Zero is the normal case; a non-zero count
    /// is the honest caveat on the usage numbers.
    pub skipped_lines: u32,
}

/// Aggregate the recent scan history into a digest.
pub fn get_scans_digest(conn: &Connection) -> rusqlite::Result<ScansDigest> {
    // Diagnostics are per scan, so only the most recent one describes what the
    // user is looking at now.
    let skipped_lines = conn.query_row(
        "SELECT COALESCE(SUM(skipped_lines), 0) FROM scan_diagnostics
          WHERE scan_id = (SELECT MAX(id) FROM scans)",
        [],
        |r| r.get::<_, i64>(0),
    )? as u32;
    let file_count =
        conn.query_row("SELECT COUNT(*) FROM files", [], |r| r.get::<_, i64>(0))? as u32;
    if file_count == 0 {
        return Ok(ScansDigest {
            has_data: false,
            overall_grade: Grade::A,
            net_health: 0,
            improved: 0,
            regressed: 0,
            scan_count: 0,
            trend: Vec::new(),
            needs_attention: Vec::new(),
            skipped_lines,
        });
    }

    let scan_count =
        conn.query_row("SELECT COUNT(*) FROM scans", [], |r| r.get::<_, i64>(0))? as u32;
    let overall_score = conn.query_row("SELECT COALESCE(AVG(score), 100) FROM files", [], |r| {
        r.get::<_, f64>(0)
    })? as u32;

    let mut trend_stmt = conn.prepare(
        "SELECT score FROM grade_history WHERE scope = 'overall' ORDER BY id DESC LIMIT 7",
    )?;
    let mut trend: Vec<u32> = trend_stmt
        .query_map([], |r| r.get::<_, i64>(0).map(|n| n as u32))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    trend.reverse();
    let net_health = if trend.len() >= 2 {
        trend[trend.len() - 1] as i32 - trend[0] as i32
    } else {
        0
    };

    // Per-file history → improved / regressed / new.
    let mut files_stmt = conn.prepare("SELECT id, path, kind, project_id, grade FROM files")?;
    let files: Vec<(String, String, String, String, String)> = files_stmt
        .query_map([], |r| {
            Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    let (mut improved, mut regressed) = (0u32, 0u32);
    let (mut regressed_items, mut new_items, mut improved_items) =
        (Vec::new(), Vec::new(), Vec::new());

    for (id, path, kind, project, grade) in &files {
        let name = std::path::Path::new(path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(kind.as_str());
        let mut hstmt = conn.prepare(
            "SELECT score FROM grade_history WHERE scope = 'file' AND scope_id = ?1 ORDER BY id DESC LIMIT 2",
        )?;
        let scores: Vec<i64> = hstmt
            .query_map([id], |r| r.get::<_, i64>(0))?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        if scores.len() < 2 {
            new_items.push(DigestItem {
                kind: "new".to_string(),
                file_id: id.clone(),
                title: format!("{name} — first scan"),
                detail: format!("{project} · grade {grade}"),
            });
            continue;
        }

        let delta = scores[0] - scores[1];
        let prev = grade_for_score(scores[1] as u32).letter();
        if delta > 0 {
            improved += 1;
            improved_items.push(DigestItem {
                kind: "improved".to_string(),
                file_id: id.clone(),
                title: format!("{name} improved {prev} → {grade}"),
                detail: format!("{project} · +{delta}"),
            });
        } else if delta < 0 {
            regressed += 1;
            regressed_items.push(DigestItem {
                kind: "regressed".to_string(),
                file_id: id.clone(),
                title: format!("{name} dropped {prev} → {grade}"),
                detail: format!("{project} · {delta}"),
            });
        }
    }

    let mut needs_attention = regressed_items;
    needs_attention.extend(new_items);
    needs_attention.extend(improved_items);
    needs_attention.truncate(8);

    Ok(ScansDigest {
        has_data: true,
        overall_grade: grade_for_score(overall_score),
        net_health,
        improved,
        regressed,
        scan_count,
        trend,
        needs_attention,
        skipped_lines,
    })
}

/// A rule (built-in or custom) with its current enabled state.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct RuleInfo {
    pub id: String,
    pub title: String,
    pub description: String,
    pub source: Source,
    pub severity: Severity,
    pub enabled: bool,
    /// True for user-created custom rules (deletable).
    pub custom: bool,
    /// True for natural-language rules evaluated by the AI provider.
    pub nl: bool,
    /// The forbidden substring (pattern rules) or the instruction (NL rules).
    pub pattern: Option<String>,
    /// Open issues this rule is currently responsible for — dismissed ones
    /// stop counting, so silencing a finding silences the number too.
    pub hit_count: u32,
}

/// Seed the rules table from the built-in catalog. Idempotent — preserves the
/// user's `enabled` toggle, but *upserts* the metadata (source, severity,
/// title, description) on every seed so existing installs pick up rule
/// repurposes (e.g. no-hardcoded-model → deprecated-model) instead of
/// keeping stale metadata forever.
pub fn seed_rules(conn: &Connection) -> rusqlite::Result<()> {
    for rule in builtin_rules() {
        conn.execute(
            "INSERT INTO rules(id, source, severity, title, description, enabled)
             VALUES(?1, ?2, ?3, ?4, ?5, 1)
             ON CONFLICT(id) DO UPDATE SET
                 source = excluded.source,
                 severity = excluded.severity,
                 title = excluded.title,
                 description = excluded.description",
            params![
                rule.id(),
                rule.source().as_str(),
                rule.severity().as_str(),
                rule.title(),
                rule.why(),
            ],
        )?;
    }
    Ok(())
}

/// Seed the built-in NL standards catalog. Idempotent — preserves toggles.
pub fn seed_builtin_nl_rules(conn: &Connection) -> rusqlite::Result<()> {
    for rule in crate::rules::builtin_nl_rules() {
        conn.execute(
            "INSERT OR IGNORE INTO rules(id, source, severity, title, description, enabled, kind)
             VALUES(?1, ?2, ?3, ?4, ?5, 1, 'nl')",
            params![
                rule.id,
                rule.source.as_str(),
                rule.severity.as_str(),
                rule.title,
                rule.instruction,
            ],
        )?;
    }
    Ok(())
}

/// The built-in rules with their enabled state (defaults to on if unseeded).
pub fn list_rules(conn: &Connection) -> rusqlite::Result<Vec<RuleInfo>> {
    let mut hits = std::collections::HashMap::new();
    {
        let mut stmt = conn.prepare(
            "SELECT rule_id, COUNT(*) FROM issues
              WHERE rule_id IS NOT NULL AND dismissed_at IS NULL GROUP BY rule_id",
        )?;
        let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)))?;
        for row in rows {
            let (id, n) = row?;
            hits.insert(id, n.max(0) as u32);
        }
    }
    let mut enabled = std::collections::HashMap::new();
    {
        let mut stmt = conn.prepare("SELECT id, enabled FROM rules")?;
        let rows = stmt.query_map([], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)? != 0))
        })?;
        for row in rows {
            let (id, on) = row?;
            enabled.insert(id, on);
        }
    }
    let mut out: Vec<RuleInfo> = builtin_rules()
        .iter()
        .map(|rule| RuleInfo {
            id: rule.id().to_string(),
            title: rule.title().to_string(),
            description: rule.why().to_string(),
            source: rule.source(),
            severity: rule.severity(),
            enabled: enabled.get(rule.id()).copied().unwrap_or(true),
            custom: false,
            nl: false,
            pattern: None,
            hit_count: hits.get(rule.id()).copied().unwrap_or(0),
        })
        .collect();

    for rule in crate::rules::builtin_nl_rules() {
        out.push(RuleInfo {
            id: rule.id.to_string(),
            title: rule.title.to_string(),
            description: rule.instruction.to_string(),
            source: rule.source,
            severity: rule.severity,
            enabled: enabled.get(rule.id).copied().unwrap_or(true),
            custom: false,
            nl: true,
            pattern: Some(rule.instruction.to_string()),
            hit_count: hits.get(rule.id).copied().unwrap_or(0),
        });
    }

    let mut stmt = conn.prepare(
        "SELECT id, title, expr, severity, enabled, kind FROM custom_rules
         WHERE kind IN ('pattern', 'nl') ORDER BY id",
    )?;
    let custom = stmt.query_map([], |r| {
        let expr: String = r.get(2)?;
        let kind: String = r.get(5)?;
        let nl = kind == "nl";
        let id: String = r.get(0)?;
        Ok(RuleInfo {
            hit_count: hits.get(&id).copied().unwrap_or(0),
            id,
            title: r.get(1)?,
            description: if nl {
                format!("AI rule — {expr}")
            } else {
                format!("Flags prompts containing “{expr}”.")
            },
            source: Source::Custom,
            severity: severity_from_db(&r.get::<_, String>(3)?),
            enabled: r.get::<_, i64>(4)? != 0,
            custom: true,
            nl,
            pattern: Some(expr),
        })
    })?;
    for rule in custom {
        out.push(rule?);
    }
    Ok(out)
}

/// Enable/disable a single rule (built-in or custom).
pub fn set_rule(conn: &Connection, id: &str, enabled: bool) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE rules SET enabled = ?1 WHERE id = ?2",
        params![enabled as i64, id],
    )?;
    conn.execute(
        "UPDATE custom_rules SET enabled = ?1 WHERE id = ?2",
        params![enabled as i64, id],
    )?;
    Ok(())
}

/// Add a custom pattern rule (forbidden substring). Returns its id.
pub fn add_custom_rule(
    conn: &Connection,
    title: &str,
    pattern: &str,
    severity: &str,
) -> rusqlite::Result<String> {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let id = format!("custom-{nanos}");
    conn.execute(
        "INSERT INTO custom_rules(id, kind, expr, severity, title, enabled)
         VALUES(?1, 'pattern', ?2, ?3, ?4, 1)",
        params![id, pattern, severity, title],
    )?;
    Ok(id)
}

/// Add a natural-language rule (an instruction the AI provider evaluates).
/// Returns its id. Evaluation is gated on a configured provider; the rule can
/// still be stored without one.
pub fn add_nl_rule(
    conn: &Connection,
    title: &str,
    instruction: &str,
    severity: &str,
) -> rusqlite::Result<String> {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let id = format!("custom-nl-{nanos}");
    conn.execute(
        "INSERT INTO custom_rules(id, kind, expr, severity, title, enabled)
         VALUES(?1, 'nl', ?2, ?3, ?4, 1)",
        params![id, instruction, severity, title],
    )?;
    Ok(id)
}

/// A natural-language rule ready to evaluate.
pub struct NlRuleRow {
    pub id: String,
    pub title: String,
    pub instruction: String,
    pub severity: String,
    pub source: String,
}

/// Enabled NL rules: the built-in catalog (free — provider-gated only), plus
/// the user's custom NL rules when `include_custom` (licensed).
pub fn enabled_nl_rules(
    conn: &Connection,
    include_custom: bool,
) -> rusqlite::Result<Vec<NlRuleRow>> {
    let mut enabled = std::collections::HashMap::new();
    {
        let mut stmt = conn.prepare("SELECT id, enabled FROM rules WHERE kind = 'nl'")?;
        let rows = stmt.query_map([], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)? != 0))
        })?;
        for row in rows {
            let (id, on) = row?;
            enabled.insert(id, on);
        }
    }
    let mut out: Vec<NlRuleRow> = crate::rules::builtin_nl_rules()
        .into_iter()
        .filter(|r| enabled.get(r.id).copied().unwrap_or(true))
        .map(|r| NlRuleRow {
            id: r.id.to_string(),
            title: r.title.to_string(),
            instruction: r.instruction.to_string(),
            severity: r.severity.as_str().to_string(),
            source: r.source.as_str().to_string(),
        })
        .collect();

    if include_custom {
        let mut stmt = conn.prepare(
            "SELECT id, title, expr, severity FROM custom_rules
             WHERE kind = 'nl' AND enabled = 1 ORDER BY id",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok(NlRuleRow {
                id: r.get(0)?,
                title: r.get(1)?,
                instruction: r.get(2)?,
                severity: r.get(3)?,
                source: "custom".to_string(),
            })
        })?;
        for row in rows {
            out.push(row?);
        }
    }
    Ok(out)
}

/// The rule ids that mark an issue as NL-sourced.
///
/// This is the *explicit* marker for "the AI found this". A non-NULL
/// `rule_id` is not one: every deterministic and custom-pattern finding
/// carries its rule id too, so anything that keys off that instead would
/// treat the scanner's own findings as the AI's and delete them.
///
/// Same set `snapshot_prior_nl_state` carries forward and
/// `evaluate_nl_rules` checks against, so all three agree on what an NL
/// issue is.
pub fn nl_rule_ids(conn: &Connection) -> rusqlite::Result<std::collections::HashSet<String>> {
    Ok(enabled_nl_rules(conn, true)?
        .into_iter()
        .map(|r| r.id)
        .collect())
}

/// `?, ?, ?` — one placeholder per element, for an `IN (...)` clause.
pub(crate) fn placeholders(n: usize) -> String {
    vec!["?"; n].join(", ")
}

/// A cheap fingerprint of *which* issues are currently attached to a file —
/// not just how many/severe. Two checks can land on the same net score while
/// disagreeing about which rule is violated (e.g. a verdict flip that swaps
/// one `mid` issue for a different `mid` issue); the score alone can't tell
/// those apart, so `apply_nl_verdicts`'s history dedupe also compares this
/// signature (#94 P2).
fn issue_signature(tx: &rusqlite::Transaction, file_id: &str) -> rusqlite::Result<String> {
    let mut stmt =
        tx.prepare("SELECT rule_id, severity, title FROM issues WHERE file_id = ?1 ORDER BY rule_id, severity, title")?;
    let rows = stmt.query_map([file_id], |r| {
        let rule_id: Option<String> = r.get(0)?;
        let severity: String = r.get(1)?;
        let title: String = r.get(2)?;
        Ok(format!(
            "{}:{}:{}",
            rule_id.unwrap_or_default(),
            severity,
            title
        ))
    })?;
    let mut parts = Vec::new();
    for row in rows {
        parts.push(row?);
    }
    Ok(parts.join("|"))
}

/// Persist NL verdicts for a file: replace prior NL-sourced issues (the ones
/// whose rule is an NL rule — see [`nl_rule_ids`]; a deterministic finding
/// also has a `rule_id` and must survive an AI re-check), insert current
/// violations, and rescore the file with the
/// unchanged formula. Also appends to `grade_history` (#86) — both the file's
/// own scope and the `overall` scope the Overview trend/sparkline reads — so
/// an AI-standards rescore is reflected the same way a scan's baseline score
/// is. The file-scope write is skipped only when it would duplicate the
/// latest entry's score *and* issue signature (#94 P2) — a re-check that
/// swaps which rule is violated at the same net score still gets recorded.
/// A prior row with no recorded signature (written before this dedupe
/// existed, or by the full-rescan path in `scan.rs`, which always appends
/// unconditionally) falls back to the old score-only comparison, so a
/// genuinely unchanged re-check right after a plain scan still doesn't spam
/// history. The overall-scope write keeps the simpler score-only dedupe — it
/// aggregates every file, so a single file's rule swap isn't its concern.
/// Returns `(score, grade_letter)`.
pub fn apply_nl_verdicts(
    conn: &Connection,
    file_id: &str,
    verdicts: &[crate::ai_rules::NlVerdict],
) -> rusqlite::Result<(u32, String)> {
    // Everything this call is allowed to replace: the enabled NL rules, plus
    // any rule these verdicts speak for (one disabled mid-check would
    // otherwise leave its old issue behind next to the new one).
    let mut nl_ids: Vec<String> = nl_rule_ids(conn)?.into_iter().collect();
    nl_ids.extend(verdicts.iter().map(|v| v.rule_id.clone()));
    nl_ids.sort();
    nl_ids.dedup();

    let tx = conn.unchecked_transaction()?;
    if !nl_ids.is_empty() {
        let sql = format!(
            "DELETE FROM issues WHERE file_id = ? AND rule_id IN ({})",
            placeholders(nl_ids.len())
        );
        let args = std::iter::once(file_id.to_string()).chain(nl_ids.iter().cloned());
        tx.execute(&sql, rusqlite::params_from_iter(args))?;
    }
    // NL verdicts only carry the rule id — look up its quality dimension from
    // the built-in catalog; custom NL rules (not in the catalog) default to
    // Consistency, matching custom pattern-rule issues.
    let catalog = crate::rules::builtin_nl_rules();
    for v in verdicts.iter().filter(|v| v.violates) {
        let dimension = catalog
            .iter()
            .find(|r| r.id == v.rule_id)
            .map(|r| r.dimension)
            .unwrap_or(crate::engine::Dimension::Consistency);
        tx.execute(
            "INSERT INTO issues(file_id, rule_id, line, severity, source, title, why, fix_from, fix_to, dimension)
             VALUES(?1, ?2, NULL, ?3, ?4, ?5, ?6, NULL, NULL, ?7)",
            params![
                file_id,
                v.rule_id,
                v.severity,
                v.source,
                v.title,
                v.explanation,
                dimension.as_str()
            ],
        )?;
    }

    let (mut hi, mut mid, mut lo) = (0u32, 0u32, 0u32);
    {
        let mut stmt = tx.prepare("SELECT severity FROM issues WHERE file_id = ?1")?;
        let rows = stmt.query_map([file_id], |r| r.get::<_, String>(0))?;
        for row in rows {
            match row?.as_str() {
                "hi" => hi += 1,
                "mid" => mid += 1,
                _ => lo += 1,
            }
        }
    }
    let score = crate::engine::score_for_counts(hi, mid, lo);
    let grade = crate::engine::grade_for_score(score);
    tx.execute(
        "UPDATE files
         SET score = ?1, grade = ?2,
             issue_count = (SELECT COUNT(*) FROM issues WHERE file_id = ?3)
         WHERE id = ?3",
        params![score as i64, grade.letter(), file_id],
    )?;

    let now = crate::scan::now_epoch();
    let signature = issue_signature(&tx, file_id)?;

    let last_file: Option<(i64, Option<String>)> = tx
        .query_row(
            "SELECT score, issue_signature FROM grade_history
             WHERE scope = 'file' AND scope_id = ?1
             ORDER BY id DESC LIMIT 1",
            [file_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;
    let is_duplicate = match &last_file {
        Some((last_score, Some(last_sig))) => *last_score == score as i64 && last_sig == &signature,
        Some((last_score, None)) => *last_score == score as i64,
        None => false,
    };
    if !is_duplicate {
        tx.execute(
            "INSERT INTO grade_history(scope, scope_id, score, recorded_at, issue_signature)
             VALUES('file', ?1, ?2, ?3, ?4)",
            params![file_id, score as i64, now, signature],
        )?;
    }

    let overall_score: i64 = tx
        .query_row("SELECT COALESCE(AVG(score), 100) FROM files", [], |r| {
            r.get::<_, f64>(0)
        })
        .map(|avg| avg as i64)?;
    let last_overall_score: Option<i64> = tx
        .query_row(
            "SELECT score FROM grade_history WHERE scope = 'overall' AND scope_id = 'overall'
             ORDER BY id DESC LIMIT 1",
            [],
            |r| r.get(0),
        )
        .optional()?;
    if last_overall_score != Some(overall_score) {
        tx.execute(
            "INSERT INTO grade_history(scope, scope_id, score, recorded_at) VALUES('overall', 'overall', ?1, ?2)",
            params![overall_score, now],
        )?;
    }

    tx.commit()?;
    Ok((score, grade.letter().to_string()))
}

/// Delete a custom rule.
pub fn delete_custom_rule(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM custom_rules WHERE id = ?1", [id])?;
    Ok(())
}

/// Issues from enabled custom pattern rules for a file's content.
pub fn custom_issues(conn: &Connection, content: &str) -> Vec<crate::engine::Issue> {
    use crate::engine::{Issue, Source};
    let lower = content.to_lowercase();
    let mut out = Vec::new();
    let Ok(mut stmt) = conn.prepare(
        "SELECT id, title, expr, severity FROM custom_rules WHERE enabled = 1 AND kind = 'pattern'",
    ) else {
        return out;
    };
    let Ok(rows) = stmt.query_map([], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, String>(2)?,
            r.get::<_, String>(3)?,
        ))
    }) else {
        return out;
    };
    for (id, title, expr, sev) in rows.flatten() {
        let needle = expr.to_lowercase();
        if needle.is_empty() || !lower.contains(&needle) {
            continue;
        }
        let line = content
            .lines()
            .position(|l| l.to_lowercase().contains(&needle))
            .map(|i| i as u32 + 1);
        out.push(Issue {
            rule_id: id,
            severity: severity_from_db(&sev),
            source: Source::Custom,
            title,
            why: format!("Your rule flagged the text “{expr}”."),
            line,
            fix: None,
            dimension: crate::engine::Dimension::Consistency,
        });
    }
    out
}

/// Enable/disable every rule from a source pack.
pub fn set_pack(conn: &Connection, source: &str, enabled: bool) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE rules SET enabled = ?1 WHERE source = ?2",
        params![enabled as i64, source],
    )?;
    Ok(())
}

/// Whether every rule from a source pack is enabled (defaults to true).
pub fn pack_enabled(conn: &Connection, source: &str) -> rusqlite::Result<bool> {
    let disabled: i64 = conn.query_row(
        "SELECT COUNT(*) FROM rules WHERE source = ?1 AND enabled = 0",
        [source],
        |r| r.get(0),
    )?;
    Ok(disabled == 0)
}

/// The active (enabled) rule set used for grading. An empty rules table means
/// "not seeded" → all built-ins (keeps tests + first-run working).
pub fn active_rules(conn: &Connection) -> Vec<Box<dyn Rule>> {
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM rules", [], |r| r.get(0))
        .unwrap_or(0);
    if count == 0 {
        return builtin_rules();
    }
    let mut stmt = match conn.prepare("SELECT id FROM rules WHERE enabled = 1") {
        Ok(s) => s,
        Err(_) => return builtin_rules(),
    };
    let enabled: std::collections::HashSet<String> = stmt
        .query_map([], |r| r.get::<_, String>(0))
        .map(|rows| rows.filter_map(Result::ok).collect())
        .unwrap_or_default();
    builtin_rules()
        .into_iter()
        .filter(|rule| enabled.contains(rule.id()))
        .collect()
}

/// Record `n` applied-fix events for `file_id`, one row per edit, tagged with
/// `origin` ('auto' | 'manual') and the current time. Called by `apply_fix`
/// after a successful apply (i.e. after the git-commit step that can still
/// roll the whole operation back) so a failed/rolled-back apply never leaves
/// a dangling event.
pub fn record_fix_events(
    conn: &Connection,
    file_id: &str,
    origin: &str,
    n: usize,
) -> rusqlite::Result<()> {
    let now = crate::scan::now_epoch();
    for _ in 0..n {
        conn.execute(
            "INSERT INTO fix_events (file_id, origin, applied_at) VALUES (?1, ?2, ?3)",
            params![file_id, origin, &now],
        )?;
    }
    Ok(())
}

/// Total applied-fix events, split by origin: `(total, auto, manual)`.
pub fn fix_counts(conn: &Connection) -> rusqlite::Result<(u32, u32, u32)> {
    let total: u32 = conn.query_row("SELECT COUNT(*) FROM fix_events", [], |r| r.get(0))?;
    let auto: u32 = conn.query_row(
        "SELECT COUNT(*) FROM fix_events WHERE origin = 'auto'",
        [],
        |r| r.get(0),
    )?;
    let manual: u32 = conn.query_row(
        "SELECT COUNT(*) FROM fix_events WHERE origin = 'manual'",
        [],
        |r| r.get(0),
    )?;
    Ok((total, auto, manual))
}

/// Everything the Analytics page needs, rolled up in one round trip.
/// `range_days` windows only the `trend`; every other field (including the
/// lifetime `issues_fixed_*` totals from [`fix_counts`]) is unwindowed.
pub fn get_analytics(conn: &Connection, range_days: u32) -> rusqlite::Result<Analytics> {
    let overall_score = conn.query_row("SELECT COALESCE(AVG(score), 100) FROM files", [], |r| {
        r.get::<_, f64>(0)
    })? as u32;
    let overall_grade = grade_for_score(overall_score);

    let files_tracked =
        conn.query_row("SELECT COUNT(*) FROM files", [], |r| r.get::<_, i64>(0))? as u32;
    let project_count =
        conn.query_row("SELECT COUNT(*) FROM projects", [], |r| r.get::<_, i64>(0))? as u32;

    let (issues_fixed_total, issues_fixed_auto, issues_fixed_manual) = fix_counts(conn)?;

    let open_issues =
        conn.query_row("SELECT COUNT(*) FROM issues", [], |r| r.get::<_, i64>(0))? as u32;
    let open_critical = conn.query_row(
        "SELECT COUNT(*) FROM issues WHERE severity = 'hi'",
        [],
        |r| r.get::<_, i64>(0),
    )? as u32;

    // Fixed A..F order, zero-filled — never rely on GROUP BY to surface every
    // grade (a grade with no files simply wouldn't have a row).
    let mut counts_by_grade: std::collections::HashMap<String, u32> =
        std::collections::HashMap::new();
    {
        let mut stmt = conn.prepare("SELECT grade, COUNT(*) FROM files GROUP BY grade")?;
        let rows = stmt.query_map([], |r| {
            let grade: Option<String> = r.get(0)?;
            let count: i64 = r.get(1)?;
            Ok((grade.unwrap_or_default(), count as u32))
        })?;
        for row in rows {
            let (grade, count) = row?;
            counts_by_grade.insert(grade, count);
        }
    }
    let grade_distribution: Vec<GradeCount> = ["A", "B", "C", "D", "F"]
        .into_iter()
        .map(|g| GradeCount {
            grade: grade_from_db(g),
            count: *counts_by_grade.get(g).unwrap_or(&0),
        })
        .collect();

    // Match the codebase's epoch-time convention (`scan::now_epoch`) rather
    // than reaching for `SystemTime::now()` directly here.
    let now: i64 = crate::scan::now_epoch().parse().unwrap_or(0);
    let cutoff = now - (range_days as i64) * 86400;
    let mut trend_stmt = conn.prepare(
        "SELECT recorded_at, score FROM grade_history
         WHERE scope = 'overall' AND CAST(recorded_at AS INTEGER) >= ?1
         ORDER BY CAST(recorded_at AS INTEGER)",
    )?;
    let trend = trend_stmt
        .query_map(params![cutoff], |r| {
            Ok(TrendPoint {
                t: r.get::<_, String>(0)?,
                score: r.get::<_, i64>(1)? as u32,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    let overall_delta = if trend.len() >= 2 {
        trend[trend.len() - 1].score as i32 - trend[0].score as i32
    } else {
        0
    };

    let mut common_stmt = conn.prepare(
        "SELECT title, COUNT(DISTINCT file_id) FROM issues
         GROUP BY title ORDER BY 2 DESC LIMIT 6",
    )?;
    let common_issues = common_stmt
        .query_map([], |r| {
            Ok(CommonIssue {
                title: r.get(0)?,
                files_affected: r.get::<_, i64>(1)? as u32,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    Ok(Analytics {
        overall_score,
        overall_grade,
        overall_delta,
        files_tracked,
        project_count,
        issues_fixed_total,
        issues_fixed_auto,
        issues_fixed_manual,
        open_issues,
        open_critical,
        grade_distribution,
        trend,
        common_issues,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn source_from_db_parses_cursor() {
        assert_eq!(source_from_db("cursor"), Source::Cursor);
    }

    #[test]
    fn empty_db_has_no_data() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        let ov = get_overview(&conn).unwrap();
        assert!(!ov.has_data);
        assert_eq!(ov.file_count, 0);
    }

    #[test]
    fn overview_reflects_a_scan() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("api-worker")).unwrap();
        std::fs::write(
            dir.path().join("api-worker/CLAUDE.md"),
            "You are an assistant.\nAlways use gpt-4.\nBe concise but thorough.\n",
        )
        .unwrap();
        crate::scan::run_scan(&conn, dir.path(), |_, _| {}).unwrap();

        let ov = get_overview(&conn).unwrap();
        assert!(ov.has_data);
        assert_eq!(ov.file_count, 1);
        // Contradiction (Hi); empty-stub is Mid since the #92 softening, so
        // only one critical remains on this fixture.
        assert!(ov.critical >= 1);
        assert!(!ov.worklist.is_empty());
        assert_eq!(ov.worklist[0].severity, Severity::Hi);
    }

    #[test]
    fn list_files_is_sorted_best_grade_first() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("good")).unwrap();
        std::fs::write(
            dir.path().join("good/AGENTS.md"),
            "You are a senior reviewer for this codebase.\nFocus on correctness and clear, idiomatic style.\nRespond in JSON.\nFor example:\n```\n{}\n```\n",
        )
        .unwrap();
        std::fs::create_dir_all(dir.path().join("bad")).unwrap();
        std::fs::write(
            dir.path().join("bad/CLAUDE.md"),
            "You are an assistant.\nAlways use gpt-4.\nBe concise but thorough.\n",
        )
        .unwrap();
        crate::scan::run_scan(&conn, dir.path(), |_, _| {}).unwrap();

        let files = list_files(&conn).unwrap();
        assert_eq!(files.len(), 2);
        assert_eq!(files[0].grade, Grade::A);
        assert_eq!(files[0].name, "AGENTS.md");
        assert!(files[1].issue_count >= 2);
    }

    #[test]
    fn file_detail_has_content_and_issues() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("CLAUDE.md"),
            "You are an assistant.\nAlways use gpt-4.\nBe concise but thorough.\n",
        )
        .unwrap();
        crate::scan::run_scan(&conn, dir.path(), |_, _| {}).unwrap();

        let id = &list_files(&conn).unwrap()[0].id.clone();
        let detail = get_file_detail(&conn, id).unwrap().unwrap();
        assert_eq!(detail.name, "CLAUDE.md");
        assert!(detail.content.contains("gpt-4"));
        assert!(!detail.issues.is_empty());
        assert_eq!(detail.issues[0].severity, Severity::Hi);

        assert!(get_file_detail(&conn, "does-not-exist").unwrap().is_none());
    }

    #[test]
    fn file_detail_dimensions_are_five_in_fixed_order_with_only_consistency_penalized() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        conn.execute(
            "INSERT INTO projects(id, name, root_path) VALUES('p', 'p', '/tmp')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files(id, project_id, path, kind, grade, score, issue_count, modified_at)
             VALUES('f', 'p', '/tmp/f', 'CLAUDE.md', 'A', 100, 1, NULL)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO issues(file_id, severity, source, title, why, dimension)
             VALUES('f', 'hi', 'anthropic', 'Contradiction', 'w', 'Consistency')",
            [],
        )
        .unwrap();

        let detail = get_file_detail(&conn, "f").unwrap().unwrap();
        assert_eq!(detail.dimensions.len(), 5);
        assert_eq!(
            detail
                .dimensions
                .iter()
                .map(|d| d.dimension.clone())
                .collect::<Vec<_>>(),
            vec!["Clarity", "Consistency", "Structure", "Examples", "Format"]
        );
        for d in &detail.dimensions {
            if d.dimension == "Consistency" {
                assert!(d.score < 100, "Consistency score should be penalized");
            } else {
                assert_eq!(d.score, 100, "{} should be untouched", d.dimension);
            }
        }
    }

    #[test]
    fn trends_track_score_changes_across_scans() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("CLAUDE.md");

        // First scan: a poor prompt.
        std::fs::write(
            &file,
            "You are an assistant.\nAlways use gpt-4.\nBe concise but thorough.\n",
        )
        .unwrap();
        crate::scan::run_scan(&conn, dir.path(), |_, _| {}).unwrap();
        let before = get_overview(&conn).unwrap();

        // Second scan: the same file, now clean.
        std::fs::write(
            &file,
            "You are a senior reviewer.\nRespond in JSON.\nFor example:\n```\n{}\n```\n",
        )
        .unwrap();
        crate::scan::run_scan(&conn, dir.path(), |_, _| {}).unwrap();
        let after = get_overview(&conn).unwrap();

        assert!(after.overall_score > before.overall_score);
        assert!(after.trend_delta > 0, "trend_delta: {}", after.trend_delta);
        assert!(after.last_scan.is_some());

        let id = list_files(&conn).unwrap()[0].id.clone();
        let detail = get_file_detail(&conn, &id).unwrap().unwrap();
        assert!(detail.delta.unwrap() > 0, "file delta: {:?}", detail.delta);
    }

    #[test]
    fn digest_reports_regressions() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("CLAUDE.md");

        std::fs::write(
            &file,
            "You are a senior reviewer.\nRespond in JSON.\nFor example:\n```\n{}\n```\n",
        )
        .unwrap();
        crate::scan::run_scan(&conn, dir.path(), |_, _| {}).unwrap();
        std::fs::write(
            &file,
            "You are an assistant.\nAlways use gpt-4.\nBe concise but thorough.\n",
        )
        .unwrap();
        crate::scan::run_scan(&conn, dir.path(), |_, _| {}).unwrap();

        let digest = get_scans_digest(&conn).unwrap();
        assert!(digest.has_data);
        assert_eq!(digest.scan_count, 2);
        assert!(digest.regressed >= 1);
        assert!(digest.net_health < 0, "net_health: {}", digest.net_health);
        assert!(digest.needs_attention.iter().any(|i| i.kind == "regressed"));
    }

    /// Only the latest scan's diagnostics reach the digest, summed across
    /// every harness that reported one.
    #[test]
    fn digest_sums_skipped_lines_of_the_latest_scan_only() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("CLAUDE.md"), "You are an assistant.\n").unwrap();
        crate::scan::run_scan(&conn, dir.path(), |_, _| {}).unwrap();
        assert_eq!(get_scans_digest(&conn).unwrap().skipped_lines, 0);

        conn.execute(
            "INSERT INTO scan_diagnostics(scan_id, harness, skipped_lines)
             VALUES((SELECT max(id) FROM scans), 'claude_code', 3)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO scan_diagnostics(scan_id, harness, skipped_lines)
             VALUES((SELECT max(id) FROM scans), 'other', 4)",
            [],
        )
        .unwrap();
        assert_eq!(get_scans_digest(&conn).unwrap().skipped_lines, 7);

        // A newer scan that skipped nothing supersedes the old diagnostics.
        crate::scan::run_scan(&conn, dir.path(), |_, _| {}).unwrap();
        assert_eq!(get_scans_digest(&conn).unwrap().skipped_lines, 0);
    }

    #[test]
    fn rule_toggles_affect_active_set() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        seed_rules(&conn).unwrap();
        assert_eq!(active_rules(&conn).len(), 14);

        set_rule(&conn, "no-hardcoded-model", false).unwrap();
        let active = active_rules(&conn);
        assert_eq!(active.len(), 13);
        assert!(!active.iter().any(|r| r.id() == "no-hardcoded-model"));
        assert!(list_rules(&conn)
            .unwrap()
            .iter()
            .any(|r| r.id == "no-hardcoded-model" && !r.enabled));
    }

    #[test]
    fn seed_rules_upserts_metadata_but_preserves_enabled_flag() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();

        // Simulate an old install: stale metadata from the rule's previous
        // incarnation, one row disabled by the user and one left enabled.
        conn.execute(
            "INSERT INTO rules(id, source, severity, title, description, enabled)
             VALUES('no-hardcoded-model', 'karpathy', 'hi', 'Hardcoded model name', 'old copy', 0)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO rules(id, source, severity, title, description, enabled)
             VALUES('empty-stub', 'custom', 'hi', 'old title', 'old copy', 1)",
            [],
        )
        .unwrap();

        seed_rules(&conn).unwrap();

        let (source, severity, title, enabled): (String, String, String, i64) = conn
            .query_row(
                "SELECT source, severity, title, enabled FROM rules WHERE id = 'no-hardcoded-model'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
            )
            .unwrap();
        assert_eq!(source, "custom");
        assert_eq!(severity, "mid");
        assert_eq!(title, "Deprecated model name");
        assert_eq!(enabled, 0, "user's disabled toggle must survive re-seed");

        let (severity, enabled): (String, i64) = conn
            .query_row(
                "SELECT severity, enabled FROM rules WHERE id = 'empty-stub'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(severity, "mid");
        assert_eq!(enabled, 1, "enabled rows stay enabled after re-seed");
    }

    #[test]
    fn pack_toggle_disables_a_whole_source() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        seed_rules(&conn).unwrap();

        set_pack(&conn, "openai", false).unwrap();
        assert!(!pack_enabled(&conn, "openai").unwrap());
        assert!(pack_enabled(&conn, "anthropic").unwrap());
        assert!(!active_rules(&conn)
            .iter()
            .any(|r| r.source() == Source::Openai));
    }

    #[test]
    fn custom_rules_flag_toggle_and_delete() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();

        add_custom_rule(&conn, "No Slack", "slack", "mid").unwrap();
        let issues = custom_issues(&conn, "Ping the team on Slack when done.");
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].severity, Severity::Mid);
        assert_eq!(issues[0].source, Source::Custom);

        let rules = list_rules(&conn).unwrap();
        let custom = rules.iter().find(|r| r.custom).expect("custom rule listed");
        assert_eq!(custom.title, "No Slack");
        let id = custom.id.clone();

        set_rule(&conn, &id, false).unwrap();
        assert!(custom_issues(&conn, "uses Slack").is_empty());

        delete_custom_rule(&conn, &id).unwrap();
        assert!(!list_rules(&conn).unwrap().iter().any(|r| r.custom));
    }

    #[test]
    fn nl_seed_is_idempotent_and_preserves_toggles() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        seed_builtin_nl_rules(&conn).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM rules WHERE kind = 'nl'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(count, 25);

        set_rule(&conn, "anthropic-clarity", false).unwrap();
        seed_builtin_nl_rules(&conn).unwrap(); // re-seed must not resurrect or duplicate
        let count_again: i64 = conn
            .query_row("SELECT COUNT(*) FROM rules WHERE kind = 'nl'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(count_again, 25);
        let enabled: i64 = conn
            .query_row(
                "SELECT enabled FROM rules WHERE id = 'anthropic-clarity'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(enabled, 0);
    }

    #[test]
    fn enabled_nl_rules_unions_catalog_and_custom_by_entitlement() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        seed_builtin_nl_rules(&conn).unwrap();
        add_nl_rule(&conn, "No Slack", "VIOLATES if it mentions Slack.", "mid").unwrap();
        set_rule(&conn, "anthropic-clarity", false).unwrap();

        let free = enabled_nl_rules(&conn, false).unwrap();
        assert_eq!(free.len(), 24, "24 enabled built-ins, no custom");
        assert!(free.iter().all(|r| !r.id.starts_with("custom-nl-")));
        assert!(!free.iter().any(|r| r.id == "anthropic-clarity"));
        assert!(free.iter().any(|r| r.source == "cursor"));

        let paid = enabled_nl_rules(&conn, true).unwrap();
        assert_eq!(paid.len(), 25, "24 built-ins + 1 custom");
        assert!(paid
            .iter()
            .any(|r| r.id.starts_with("custom-nl-") && r.source == "custom"));
    }

    #[test]
    fn nl_verdicts_persist_as_issues_and_rescore() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        conn.execute(
            "INSERT INTO projects(id, name, root_path) VALUES('p', 'p', '/tmp')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files(id, project_id, path, kind, grade, score, issue_count, modified_at)
             VALUES('f', 'p', 'f', 'CLAUDE.md', 'A', 100, 1, NULL)",
            [],
        )
        .unwrap();
        // one pre-existing deterministic issue (hi): baseline 100-15 = 85
        conn.execute(
            "INSERT INTO issues(file_id, severity, source, title, why) VALUES('f', 'hi', 'anthropic', 'Det', 'w')",
            [],
        )
        .unwrap();

        let verdicts = vec![
            crate::ai_rules::NlVerdict {
                rule_id: "anthropic-clarity".into(),
                title: "Vague directives".into(),
                severity: "mid".into(),
                source: "anthropic".into(),
                violates: true,
                explanation: "Too vague.".into(),
            },
            crate::ai_rules::NlVerdict {
                rule_id: "cursor-scoped".into(),
                title: "Bloated, unscoped content".into(),
                severity: "mid".into(),
                source: "cursor".into(),
                violates: false,
                explanation: "Fine.".into(),
            },
        ];

        // hi=1, mid=1 → 100 - 15 - 7 = 78 → C
        let (score, grade) = apply_nl_verdicts(&conn, "f", &verdicts).unwrap();
        assert_eq!((score, grade.as_str()), (78, "C"));
        let n: i64 = conn
            .query_row("SELECT COUNT(*) FROM issues WHERE file_id='f'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(
            n, 2,
            "1 deterministic + 1 violating NL (pass verdicts add nothing)"
        );

        // Re-running must replace, not duplicate.
        let (score2, _) = apply_nl_verdicts(&conn, "f", &verdicts).unwrap();
        assert_eq!(score2, 78);
        let n2: i64 = conn
            .query_row("SELECT COUNT(*) FROM issues WHERE file_id='f'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(n2, 2);
        let (fscore, fcount): (i64, i64) = conn
            .query_row(
                "SELECT score, issue_count FROM files WHERE id='f'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!((fscore, fcount), (78, 2));
    }

    #[test]
    fn apply_nl_verdicts_writes_grade_history_and_dedupes_unchanged_scores() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        conn.execute(
            "INSERT INTO projects(id, name, root_path) VALUES('p', 'p', '/tmp')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files(id, project_id, path, kind, grade, score, issue_count, modified_at)
             VALUES('f', 'p', 'f', 'CLAUDE.md', 'A', 100, 0, NULL)",
            [],
        )
        .unwrap();

        let violating = vec![crate::ai_rules::NlVerdict {
            rule_id: "anthropic-clarity".into(),
            title: "Vague directives".into(),
            severity: "mid".into(),
            source: "anthropic".into(),
            violates: true,
            explanation: "Too vague.".into(),
        }];

        // mid=1 → 100 - 7 = 93
        let (score, _) = apply_nl_verdicts(&conn, "f", &violating).unwrap();
        assert_eq!(score, 93);

        let file_hist: Vec<i64> = {
            let mut stmt = conn
                .prepare(
                    "SELECT score FROM grade_history WHERE scope='file' AND scope_id='f' ORDER BY id",
                )
                .unwrap();
            stmt.query_map([], |r| r.get(0))
                .unwrap()
                .collect::<rusqlite::Result<Vec<_>>>()
                .unwrap()
        };
        assert_eq!(
            file_hist,
            vec![93],
            "the rescore must land in the same history the Detail delta reads"
        );

        let overall_hist: Vec<i64> = {
            let mut stmt = conn
                .prepare(
                    "SELECT score FROM grade_history WHERE scope='overall' AND scope_id='overall' ORDER BY id",
                )
                .unwrap();
            stmt.query_map([], |r| r.get(0))
                .unwrap()
                .collect::<rusqlite::Result<Vec<_>>>()
                .unwrap()
        };
        assert_eq!(
            overall_hist,
            vec![93],
            "the Overview sparkline must move too, not just the file delta"
        );

        // Re-running with the exact same verdicts (score unchanged) must not
        // duplicate either history row.
        apply_nl_verdicts(&conn, "f", &violating).unwrap();
        let file_hist_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM grade_history WHERE scope='file' AND scope_id='f'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(
            file_hist_count, 1,
            "unchanged rescore must not duplicate file history"
        );
        let overall_hist_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM grade_history WHERE scope='overall' AND scope_id='overall'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(
            overall_hist_count, 1,
            "unchanged rescore must not duplicate overall history"
        );

        // A verdict flip that changes the score must append a new row.
        let passing = vec![crate::ai_rules::NlVerdict {
            violates: false,
            ..violating[0].clone()
        }];
        let (score2, _) = apply_nl_verdicts(&conn, "f", &passing).unwrap();
        assert_eq!(score2, 100);
        let file_hist_count2: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM grade_history WHERE scope='file' AND scope_id='f'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(
            file_hist_count2, 2,
            "a real score change must append a new row"
        );
    }

    #[test]
    fn apply_nl_verdicts_records_a_rule_swap_at_the_same_score() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        conn.execute(
            "INSERT INTO projects(id, name, root_path) VALUES('p', 'p', '/tmp')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files(id, project_id, path, kind, grade, score, issue_count, modified_at)
             VALUES('f', 'p', 'f', 'CLAUDE.md', 'A', 100, 0, NULL)",
            [],
        )
        .unwrap();

        let violates_a = crate::ai_rules::NlVerdict {
            rule_id: "anthropic-clarity".into(),
            title: "Vague directives".into(),
            severity: "mid".into(),
            source: "anthropic".into(),
            violates: true,
            explanation: "Too vague.".into(),
        };
        // A different rule, same severity → identical net score (mid=1 → 93).
        let violates_b = crate::ai_rules::NlVerdict {
            rule_id: "openai-structure".into(),
            title: "Unstructured prompt".into(),
            severity: "mid".into(),
            source: "openai".into(),
            violates: true,
            explanation: "No sections.".into(),
        };

        let (score_a, _) =
            apply_nl_verdicts(&conn, "f", std::slice::from_ref(&violates_a)).unwrap();
        let (score_b, _) =
            apply_nl_verdicts(&conn, "f", std::slice::from_ref(&violates_b)).unwrap();
        assert_eq!(
            score_a, score_b,
            "both violations are mid — the net score must match"
        );

        // Even though the score is unchanged, the *violated rule* changed, so
        // the swap must be recorded rather than deduped away (#94 P2).
        let hist_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM grade_history WHERE scope='file' AND scope_id='f'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(
            hist_count, 2,
            "a same-score rule swap must still be recorded in history"
        );

        // Re-checking the exact same violation (same score AND signature) must
        // still dedupe — the anti-spam behavior is preserved.
        apply_nl_verdicts(&conn, "f", &[violates_b]).unwrap();
        let hist_count_after: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM grade_history WHERE scope='file' AND scope_id='f'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(
            hist_count_after, 2,
            "a genuinely unchanged re-check must not spam history"
        );
    }

    #[test]
    fn list_projects_rolls_up_counts() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        conn.execute(
            "INSERT INTO projects(id, name, root_path, grade, score) VALUES('/a','a','/a','D',52)",
            [],
        )
        .unwrap();
        conn.execute("INSERT INTO files(id, project_id, path, kind, grade, score, issue_count, modified_at) VALUES('/a/CLAUDE.md','/a','/a/CLAUDE.md','CLAUDE.md','D',52,5,'100')", []).unwrap();
        conn.execute("INSERT INTO files(id, project_id, path, kind, grade, score, issue_count, modified_at) VALUES('/a/AGENTS.md','/a','/a/AGENTS.md','AGENTS.md','F',40,6,'200')", []).unwrap();
        let projects = list_projects(&conn).unwrap();
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].file_count, 2);
        assert_eq!(projects[0].issue_count, 11);
        assert_eq!(projects[0].modified.as_deref(), Some("200"));
    }

    /// The harness columns come from a real scan: the harness pass writes
    /// `harness_projects` and the artifact inventory, the file pass writes
    /// `projects`/`files`, and `list_projects` has to join the two.
    #[test]
    fn list_projects_carries_the_harness_columns() {
        use crate::harness::claude_code::test_support::fixture_home;
        use crate::harness::claude_code::ClaudeCode;
        use crate::harness::Harness;

        let (_guard, home) = fixture_home();
        let conn = crate::store::test_conn();
        let harnesses: Vec<Box<dyn Harness>> = vec![Box::new(ClaudeCode::with_home(home.clone()))];
        let outcome = crate::harness_scan::run_harness_scan(&conn, &harnesses, 1_785_628_800)
            .expect("harness scan");
        crate::scan::run_scan_all(&conn, &outcome.roots, &outcome.extra_files, |_, _| {})
            .expect("file scan");

        let projects = list_projects(&conn).unwrap();
        let app_path = home.root.join("work/app").to_string_lossy().into_owned();
        let app = projects
            .iter()
            .find(|p| p.id == app_path)
            .expect("the scanned project is listed");
        assert_eq!(app.harness.as_deref(), Some("claude_code"));
        assert_eq!(app.session_count, 1, "top-level sessions only");
        assert!(app.last_session_at.is_some());
        assert!(app.exists);
        // The `deploy` skill plus the three MCP servers the project declares
        // (`supabase`, `github`, `linear`) — nothing in the session touched
        // any of them.
        assert_eq!(app.never_used_count, 4);
        assert_eq!(app.error_count, 0);
    }

    /// A database written before `scan::resolve_project` stripped the git
    /// worktree root's trailing separator still holds slashed ids. The list
    /// hands out the trimmed one, so the project page it opens can join.
    #[test]
    fn list_projects_hands_out_slash_free_ids() {
        let conn = crate::store::test_conn();
        conn.execute(
            "INSERT INTO projects(id, name, root_path, grade, score) VALUES('/a/','a','/a/','D',52)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files(id, project_id, path, kind, grade, score, issue_count)
             VALUES('/a/CLAUDE.md','/a/','/a/CLAUDE.md','CLAUDE.md','D',52,5)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO harness_projects(harness, path, exists_on_disk, session_count)
             VALUES('claude_code', '/a', 1, 2)",
            [],
        )
        .unwrap();

        let projects = list_projects(&conn).unwrap();
        assert_eq!(projects.len(), 1);
        assert_eq!(
            projects[0].id, "/a",
            "the id must be usable as a project path"
        );
        assert_eq!(
            projects[0].file_count, 1,
            "the file rollup still joins on the stored id"
        );
        assert_eq!(projects[0].harness.as_deref(), Some("claude_code"));
        assert_eq!(projects[0].session_count, 2);

        // The Prompts screen groups files by `project_id` and looks each group
        // up by `ProjectRow.id`; the two must agree on a pre-fix database too.
        let files = list_files(&conn).unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(
            files[0].project_id, projects[0].id,
            "FileRow.project_id must equal ProjectRow.id"
        );
    }

    /// A project with no harness row at all is still a project — it just has
    /// no harness facts, and it exists (the grader read its files).
    #[test]
    fn list_projects_defaults_a_project_with_no_harness_row() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        conn.execute(
            "INSERT INTO projects(id, name, root_path, grade, score) VALUES('/a','a','/a','D',52)",
            [],
        )
        .unwrap();
        let projects = list_projects(&conn).unwrap();
        assert_eq!(projects.len(), 1);
        assert!(projects[0].exists);
        assert_eq!(projects[0].harness, None);
        assert_eq!(projects[0].session_count, 0);
        assert_eq!(projects[0].last_session_at, None);
    }

    /// A directory the harness has seen but that is gone from disk reads as
    /// missing, so the UI can mark it instead of pretending it is live.
    #[test]
    fn list_projects_reports_a_missing_directory() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        conn.execute(
            "INSERT INTO projects(id, name, root_path, grade, score) VALUES('/gone','gone','/gone','D',52)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO harness_projects(harness, path, exists_on_disk, session_count, last_session_at)
             VALUES('claude_code', '/gone', 0, 3, '2026-08-01T00:00:00Z')",
            [],
        )
        .unwrap();
        let p = &list_projects(&conn).unwrap()[0];
        assert!(!p.exists);
        assert_eq!(p.harness.as_deref(), Some("claude_code"));
        assert_eq!(p.session_count, 3);
        assert_eq!(p.last_session_at.as_deref(), Some("2026-08-01T00:00:00Z"));
    }

    /// An artifact whose rollup says a quarter of its calls error is a problem
    /// artifact; one with no rollup at all was never used.
    #[test]
    fn list_projects_counts_never_used_and_erroring_artifacts() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        conn.execute(
            "INSERT INTO projects(id, name, root_path, grade, score) VALUES('/a','a','/a','D',52)",
            [],
        )
        .unwrap();
        let insert = |kind: &str, name: &str| {
            conn.execute(
                "INSERT INTO artifacts(harness, layer, project_path, kind, name, path, hash, seen_at)
                 VALUES('claude_code', 'project', '/a', ?1, ?2, ?3, 'h', '2026-08-01T00:00:00Z')",
                params![kind, name, format!("/a/{name}")],
            )
            .unwrap();
            conn.last_insert_rowid()
        };
        let noisy = insert("skill", "noisy");
        let quiet = insert("agent", "quiet");
        insert("command", "never-run");
        insert("mcp_server", "never-called");
        // A rule is not an invocable artifact — it never counts as unused.
        insert("rule", "CLAUDE.md");

        let roll = |artifact_id: i64, target: &str, error_rate: f64| {
            conn.execute(
                "INSERT INTO usage_stats(harness, kind, target, artifact_id, total, sessions,
                                         error_rate, count_30d, count_prev_30d)
                 VALUES('claude_code', 'skill', ?1, ?2, 4, 1, ?3, 4, 0)",
                params![target, artifact_id, error_rate],
            )
            .unwrap();
        };
        roll(noisy, "noisy", 0.25);
        roll(quiet, "quiet", 0.0);

        let p = &list_projects(&conn).unwrap()[0];
        assert_eq!(p.never_used_count, 2, "the command and the mcp server");
        assert_eq!(p.error_count, 1, "error_rate >= 0.25 is the threshold");
    }

    /// The rules screen shows how often a rule actually fires — open issues
    /// only, so dismissing one takes it off the count.
    #[test]
    fn list_rules_counts_open_issues_per_rule() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        conn.execute(
            "INSERT INTO projects(id, name, root_path) VALUES('p', 'p', '/tmp')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files(id, project_id, path, kind) VALUES('f','p','/tmp/f','CLAUDE.md')",
            [],
        )
        .unwrap();
        for dismissed in [None, Some("2026-08-01T00:00:00Z")] {
            conn.execute(
                "INSERT INTO issues(file_id, rule_id, severity, source, title, dismissed_at)
                 VALUES('f', 'anthropic-clarity', 'mid', 'anthropic', 'Unclear', ?1)",
                params![dismissed],
            )
            .unwrap();
        }
        seed_builtin_nl_rules(&conn).unwrap();
        let rules = list_rules(&conn).unwrap();
        let clarity = rules.iter().find(|r| r.id == "anthropic-clarity").unwrap();
        assert_eq!(clarity.hit_count, 1, "the dismissed issue does not count");
        assert!(rules
            .iter()
            .filter(|r| r.id != "anthropic-clarity")
            .all(|r| r.hit_count == 0));
    }

    #[test]
    fn list_rules_includes_the_nl_catalog() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        seed_builtin_nl_rules(&conn).unwrap();
        let rules = list_rules(&conn).unwrap();
        let clarity = rules
            .iter()
            .find(|r| r.id == "anthropic-clarity")
            .expect("catalog rule listed");
        assert!(clarity.nl);
        assert!(!clarity.custom);
        assert!(clarity
            .pattern
            .as_deref()
            .unwrap_or("")
            .starts_with("The file VIOLATES"));
    }

    #[test]
    fn record_fix_events_then_fix_counts_splits_by_origin() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();

        record_fix_events(&conn, "f1", "auto", 2).unwrap();
        record_fix_events(&conn, "f2", "manual", 3).unwrap();

        let (total, auto, manual) = fix_counts(&conn).unwrap();
        assert_eq!(total, 5);
        assert_eq!(auto, 2);
        assert_eq!(manual, 3);
    }

    #[test]
    fn analytics_rolls_up_grades_fixes_trend_and_common_issues() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();

        conn.execute(
            "INSERT INTO projects(id, name, root_path) VALUES('p', 'p', '/tmp')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files(id, project_id, path, kind, grade, score, issue_count, modified_at)
             VALUES('f1', 'p', '/tmp/f1', 'CLAUDE.md', 'A', 95, 1, NULL)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files(id, project_id, path, kind, grade, score, issue_count, modified_at)
             VALUES('f2', 'p', '/tmp/f2', 'CLAUDE.md', 'B', 85, 2, NULL)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files(id, project_id, path, kind, grade, score, issue_count, modified_at)
             VALUES('f3', 'p', '/tmp/f3', 'CLAUDE.md', 'F', 40, 3, NULL)",
            [],
        )
        .unwrap();

        // Two files hit "Contradiction", one hits "Hardcoded model" — common
        // issues must rank Contradiction first (2 files > 1 file).
        conn.execute(
            "INSERT INTO issues(file_id, severity, source, title, why)
             VALUES('f2', 'hi', 'anthropic', 'Contradiction', 'w')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO issues(file_id, severity, source, title, why)
             VALUES('f3', 'hi', 'anthropic', 'Contradiction', 'w')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO issues(file_id, severity, source, title, why)
             VALUES('f3', 'mid', 'anthropic', 'Hardcoded model', 'w')",
            [],
        )
        .unwrap();

        record_fix_events(&conn, "f1", "auto", 2).unwrap();
        record_fix_events(&conn, "f2", "manual", 1).unwrap();

        // Overall history: one row outside a 7-day window, two inside it.
        let now: i64 = crate::scan::now_epoch().parse().unwrap();
        let range_days: u32 = 7;
        let old = now - (range_days as i64 + 5) * 86400;
        let inside_early = now - 3 * 86400;
        let inside_late = now - 86400;
        conn.execute(
            "INSERT INTO grade_history(scope, scope_id, score, recorded_at)
             VALUES('overall', 'overall', 50, ?1)",
            params![old.to_string()],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO grade_history(scope, scope_id, score, recorded_at)
             VALUES('overall', 'overall', 60, ?1)",
            params![inside_early.to_string()],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO grade_history(scope, scope_id, score, recorded_at)
             VALUES('overall', 'overall', 75, ?1)",
            params![inside_late.to_string()],
        )
        .unwrap();

        let analytics = get_analytics(&conn, range_days).unwrap();

        assert_eq!(analytics.files_tracked, 3);
        assert_eq!(analytics.project_count, 1);

        assert_eq!(
            analytics
                .grade_distribution
                .iter()
                .map(|g| g.grade)
                .collect::<Vec<_>>(),
            vec![Grade::A, Grade::B, Grade::C, Grade::D, Grade::F],
            "grade_distribution must emit all five grades in fixed order"
        );
        let sum: u32 = analytics.grade_distribution.iter().map(|g| g.count).sum();
        assert_eq!(sum, 3, "grade_distribution must sum to files_tracked");
        assert_eq!(analytics.grade_distribution[0].count, 1); // A
        assert_eq!(analytics.grade_distribution[1].count, 1); // B
        assert_eq!(analytics.grade_distribution[2].count, 0); // C
        assert_eq!(analytics.grade_distribution[3].count, 0); // D
        assert_eq!(analytics.grade_distribution[4].count, 1); // F

        assert_eq!(analytics.issues_fixed_total, 3);
        assert_eq!(analytics.issues_fixed_auto, 2);
        assert_eq!(analytics.issues_fixed_manual, 1);

        assert_eq!(analytics.open_issues, 3);
        assert_eq!(analytics.open_critical, 2);

        // Only the two in-window rows appear, ascending by time.
        assert_eq!(analytics.trend.len(), 2);
        assert_eq!(analytics.trend[0].score, 60);
        assert_eq!(analytics.trend[1].score, 75);
        assert_eq!(analytics.overall_delta, 15);

        assert_eq!(analytics.common_issues[0].title, "Contradiction");
        assert_eq!(analytics.common_issues[0].files_affected, 2);
        assert_eq!(analytics.common_issues[1].title, "Hardcoded model");
        assert_eq!(analytics.common_issues[1].files_affected, 1);
    }
}
