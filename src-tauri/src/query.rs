//! Read-side queries that back the frontend screens.

use rusqlite::{params, Connection, OptionalExtension};

use crate::engine::{grade_for_score, Grade, Rule, Severity, Source};
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

fn severity_from_db(s: &str) -> Severity {
    match s {
        "hi" => Severity::Hi,
        "lo" => Severity::Lo,
        _ => Severity::Mid,
    }
}

fn source_from_db(s: &str) -> Source {
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

/// Everything the Overview screen needs.
pub fn get_overview(conn: &Connection) -> rusqlite::Result<Overview> {
    let scan_folder = get_setting(conn, "scan_folder")?;
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

fn grade_from_db(s: &str) -> Grade {
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
    pub project: String,
    pub grade: Grade,
    pub score: u32,
    pub issue_count: u32,
    pub modified: Option<String>,
}

/// All scanned files, best grade first.
pub fn list_files(conn: &Connection) -> rusqlite::Result<Vec<FileRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, path, kind, project_id, grade, score, issue_count, modified_at
         FROM files
         ORDER BY CASE grade WHEN 'A' THEN 0 WHEN 'B' THEN 1 WHEN 'C' THEN 2 WHEN 'D' THEN 3 ELSE 4 END,
                  project_id, kind",
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
                project: r.get(3)?,
                grade: grade_from_db(&r.get::<_, String>(4)?),
                score: r.get::<_, i64>(5)? as u32,
                issue_count: r.get::<_, i64>(6)? as u32,
                modified: r.get::<_, Option<String>>(7)?,
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
        "SELECT line, severity, source, title, why, fix_from, fix_to FROM issues WHERE file_id = ?1
         ORDER BY CASE severity WHEN 'hi' THEN 0 WHEN 'mid' THEN 1 ELSE 2 END, COALESCE(line, 1000000)",
    )?;
    let issues = stmt
        .query_map([file_id], |r| {
            let line: Option<i64> = r.get(0)?;
            Ok(IssueDetail {
                line: line.map(|l| l as u32),
                severity: severity_from_db(&r.get::<_, String>(1)?),
                source: source_from_db(&r.get::<_, String>(2)?),
                title: r.get(3)?,
                why: r.get(4)?,
                fix_from: r.get(5)?,
                fix_to: r.get(6)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

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
}

/// Aggregate the recent scan history into a digest.
pub fn get_scans_digest(conn: &Connection) -> rusqlite::Result<ScansDigest> {
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
}

/// Seed the rules table from the built-in catalog. Idempotent — preserves toggles.
pub fn seed_rules(conn: &Connection) -> rusqlite::Result<()> {
    for rule in builtin_rules() {
        conn.execute(
            "INSERT OR IGNORE INTO rules(id, source, severity, title, description, enabled)
             VALUES(?1, ?2, ?3, ?4, ?5, 1)",
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

/// The built-in rules with their enabled state (defaults to on if unseeded).
pub fn list_rules(conn: &Connection) -> rusqlite::Result<Vec<RuleInfo>> {
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
        })
        .collect();

    let mut stmt = conn.prepare(
        "SELECT id, title, expr, severity, enabled, kind FROM custom_rules
         WHERE kind IN ('pattern', 'nl') ORDER BY id",
    )?;
    let custom = stmt.query_map([], |r| {
        let expr: String = r.get(2)?;
        let kind: String = r.get(5)?;
        let nl = kind == "nl";
        Ok(RuleInfo {
            id: r.get(0)?,
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

/// A natural-language rule ready to evaluate: (id, title, instruction, severity).
pub fn enabled_nl_rules(
    conn: &Connection,
) -> rusqlite::Result<Vec<(String, String, String, String)>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, expr, severity FROM custom_rules
         WHERE kind = 'nl' AND enabled = 1 ORDER BY id",
    )?;
    let rows = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
            ))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
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
        assert!(ov.critical >= 2);
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
            "You are a senior reviewer.\nRespond in JSON.\nFor example:\n```\n{}\n```\n",
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

    #[test]
    fn rule_toggles_affect_active_set() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        seed_rules(&conn).unwrap();
        assert_eq!(active_rules(&conn).len(), 5);

        set_rule(&conn, "no-hardcoded-model", false).unwrap();
        let active = active_rules(&conn);
        assert_eq!(active.len(), 4);
        assert!(!active.iter().any(|r| r.id() == "no-hardcoded-model"));
        assert!(list_rules(&conn)
            .unwrap()
            .iter()
            .any(|r| r.id == "no-hardcoded-model" && !r.enabled));
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
}
