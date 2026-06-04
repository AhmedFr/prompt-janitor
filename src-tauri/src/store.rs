//! SQLite store: connection + schema migrations.
//!
//! Migrations are an ordered list of SQL batches. The applied count is tracked
//! with SQLite's `user_version` pragma, so re-running is idempotent.

use std::sync::Mutex;

use rusqlite::Connection;

/// Shared, thread-safe database handle held in Tauri state.
pub struct AppDb {
    pub conn: Mutex<Connection>,
    pub path: String,
}

/// Ordered schema migrations. Append-only — never edit an existing entry.
const MIGRATIONS: &[&str] = &[
    // v1 — initial schema (mirrors the design's data model)
    "
    CREATE TABLE projects (
        id        TEXT PRIMARY KEY,
        name      TEXT NOT NULL,
        root_path TEXT NOT NULL,
        grade     TEXT,
        score     INTEGER
    );
    CREATE TABLE files (
        id          TEXT PRIMARY KEY,
        project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        path        TEXT NOT NULL,
        kind        TEXT NOT NULL,
        grade       TEXT,
        score       INTEGER,
        issue_count INTEGER NOT NULL DEFAULT 0,
        modified_at TEXT
    );
    CREATE TABLE scans (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at       TEXT NOT NULL,
        finished_at      TEXT,
        files_scanned    INTEGER NOT NULL DEFAULT 0,
        net_health_delta INTEGER
    );
    CREATE TABLE issues (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id      TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
        line         INTEGER,
        severity     TEXT NOT NULL,
        source       TEXT NOT NULL,
        title        TEXT NOT NULL,
        why          TEXT,
        fix_from     TEXT,
        fix_to       TEXT,
        dismissed_at TEXT
    );
    CREATE TABLE grade_history (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        scope       TEXT NOT NULL,
        scope_id    TEXT NOT NULL,
        score       INTEGER NOT NULL,
        recorded_at TEXT NOT NULL
    );
    CREATE TABLE rules (
        id          TEXT PRIMARY KEY,
        source      TEXT NOT NULL,
        severity    TEXT NOT NULL,
        title       TEXT NOT NULL,
        description TEXT,
        enabled     INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE custom_rules (
        id       TEXT PRIMARY KEY,
        kind     TEXT NOT NULL,
        expr     TEXT NOT NULL,
        severity TEXT NOT NULL,
        title    TEXT NOT NULL,
        enabled  INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    CREATE TABLE backups (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id         TEXT NOT NULL,
        pre_fix_content TEXT NOT NULL,
        applied_at      TEXT NOT NULL,
        git_ref         TEXT
    );
    CREATE INDEX idx_files_project ON files(project_id);
    CREATE INDEX idx_issues_file ON issues(file_id);
    ",
];

/// Apply any migrations not yet applied. Idempotent.
pub fn migrate(conn: &Connection) -> rusqlite::Result<()> {
    let applied: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    for (i, sql) in MIGRATIONS.iter().enumerate() {
        if (i as i64) < applied {
            continue;
        }
        conn.execute_batch(sql)?;
        conn.pragma_update(None, "user_version", (i as i64) + 1)?;
    }
    Ok(())
}

/// Open the database at `path`, set pragmas, and run migrations.
pub fn open_and_migrate(path: &std::path::Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
    migrate(&conn)?;
    Ok(conn)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_create_schema_and_are_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();

        let version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap();
        assert_eq!(version, MIGRATIONS.len() as i64);

        let files_table: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='files'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(files_table, 1);

        // Running again must not error or double-apply.
        migrate(&conn).unwrap();
        let version_again: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap();
        assert_eq!(version_again, MIGRATIONS.len() as i64);
    }
}
