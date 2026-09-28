//! The worst open finding on a file, as one SQL expression and its parser —
//! shared by the Setup inventory and the graded-file list so both rank
//! severity the same way.

use crate::engine::Severity;

/// `hi` beats `mid` beats `lo`; `NULL` when the file has no findings.
/// `{file_id}` is the column holding the file's id in the outer query.
pub fn worst_severity_sql(file_id: &str) -> String {
    format!(
        "(SELECT CASE WHEN sum(i.severity = 'hi') > 0 THEN 'hi'
                      WHEN sum(i.severity = 'mid') > 0 THEN 'mid'
                      WHEN count(*) > 0 THEN 'lo' END
            FROM issues i WHERE i.file_id = {file_id} AND i.dismissed_at IS NULL)"
    )
}

/// The column value back to the enum; anything else is no severity.
pub fn parse_severity(raw: Option<String>) -> Option<Severity> {
    match raw.as_deref() {
        Some("hi") => Some(Severity::Hi),
        Some("mid") => Some(Severity::Mid),
        Some("lo") => Some(Severity::Lo),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::test_conn;

    fn file_with(conn: &rusqlite::Connection, id: &str, severities: &[&str]) {
        conn.execute(
            "INSERT INTO projects(id, name, root_path) VALUES('/p', 'p', '/p') ON CONFLICT DO NOTHING",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files(id, project_id, path, kind, grade, score, issue_count)
             VALUES(?1, '/p', ?1, 'CLAUDE.md', 'C', 70, ?2)",
            rusqlite::params![id, severities.len() as i64],
        )
        .unwrap();
        for s in severities {
            conn.execute(
                "INSERT INTO issues(file_id, severity, source, title, why) VALUES(?1, ?2, 'anthropic', 't', 'w')",
                rusqlite::params![id, s],
            )
            .unwrap();
        }
    }

    fn worst(conn: &rusqlite::Connection, id: &str) -> Option<Severity> {
        let sql = format!(
            "SELECT {} FROM files f WHERE f.id = ?1",
            worst_severity_sql("f.id")
        );
        parse_severity(conn.query_row(&sql, [id], |r| r.get(0)).unwrap())
    }

    #[test]
    fn critical_wins_over_everything() {
        let conn = test_conn();
        file_with(&conn, "/p/a", &["lo", "hi", "mid"]);
        assert_eq!(worst(&conn, "/p/a"), Some(Severity::Hi));
    }

    #[test]
    fn warning_wins_over_nits() {
        let conn = test_conn();
        file_with(&conn, "/p/b", &["lo", "mid"]);
        assert_eq!(worst(&conn, "/p/b"), Some(Severity::Mid));
    }

    #[test]
    fn a_file_with_no_findings_has_no_severity() {
        let conn = test_conn();
        file_with(&conn, "/p/c", &[]);
        assert_eq!(worst(&conn, "/p/c"), None);
    }

    #[test]
    fn an_unknown_value_parses_to_none() {
        assert_eq!(parse_severity(Some("urgent".into())), None);
        assert_eq!(parse_severity(None), None);
    }

    #[test]
    fn a_dismissed_finding_does_not_count() {
        let conn = test_conn();
        file_with(&conn, "/p/d", &["hi", "lo"]);
        conn.execute(
            "UPDATE issues SET dismissed_at = 'x' WHERE severity = 'hi'",
            [],
        )
        .unwrap();
        assert_eq!(worst(&conn, "/p/d"), Some(Severity::Lo));
    }
}
