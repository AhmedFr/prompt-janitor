//! Read-side queries that back the frontend screens.

use rusqlite::{params, Connection, OptionalExtension};

use crate::engine::{grade_for_score, Grade, Severity, Source};

#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct WorklistItem {
    pub file_id: String,
    pub title: String,
    pub location: String,
    pub severity: Severity,
    pub source: Source,
    pub line: Option<u32>,
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
        "SELECT i.file_id, i.title, i.severity, i.source, i.line, f.project_id, f.kind
         FROM issues i JOIN files f ON f.id = i.file_id
         ORDER BY CASE i.severity WHEN 'hi' THEN 0 WHEN 'mid' THEN 1 ELSE 2 END, f.project_id
         LIMIT 12",
    )?;
    let worklist = stmt
        .query_map([], |r| {
            let line: Option<i64> = r.get(4)?;
            let project: String = r.get(5)?;
            let kind: String = r.get(6)?;
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

#[cfg(test)]
mod tests {
    use super::*;

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
}
