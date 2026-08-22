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
    // 2: rules.kind (deterministic|nl) + issues.rule_id (tags NL-sourced issues).
    "
    ALTER TABLE rules ADD COLUMN kind TEXT NOT NULL DEFAULT 'deterministic';
    ALTER TABLE issues ADD COLUMN rule_id TEXT;
    ",
    // 3: files.content_hash — lets a rescan tell whether a file's content
    // changed since NL verdicts were last recorded, so an unchanged file can
    // carry its AI-standards issues forward instead of losing them on every
    // scheduled rescan (#85). NULL for rows written before this migration;
    // that's treated as "unknown", which conservatively means no carry-forward.
    //
    // One-time UX consequence: existing rows get content_hash = NULL, which
    // reads as "unknown" rather than "matches" — so the very first rescan
    // after upgrading to this version cannot confirm any file is unchanged
    // and drops every file's previously-recorded AI-standards issues (they
    // return once the user re-runs "Check standards" on that file). This is
    // a one-time reset on upgrade, not a recurring loss; every rescan after
    // that first one carries verdicts forward normally.
    "
    ALTER TABLE files ADD COLUMN content_hash TEXT;
    ",
    // 4: grade_history.issue_signature — lets apply_nl_verdicts's dedupe (see
    // its doc comment) distinguish "genuinely unchanged rescore" from "the
    // net score happens to match, but a different rule is now violated"
    // (#94 P2). NULL for rows written before this migration or by the
    // full-rescan path (scan.rs), which always appends a history row
    // unconditionally and has no need for the dedupe.
    "
    ALTER TABLE grade_history ADD COLUMN issue_signature TEXT;
    ",
    // 5: projects.logo — a base64 data: URI of a logo detected in the project
    // root at scan time (NULL when none found). Lets the UI show a real
    // project mark instead of a generic folder.
    "
    ALTER TABLE projects ADD COLUMN logo TEXT;
    ",
    // 6: issues.dimension — the quality dimension (Clarity|Consistency|
    // Structure|Examples|Format) a rule's finding speaks to, powering the
    // per-file dimension radar (#88 data-viz epic). NULL for rows written
    // before this migration; `Dimension::from_db` treats an unknown value as
    // `Consistency`.
    "
    ALTER TABLE issues ADD COLUMN dimension TEXT;
    ",
    // 7: fix_events — a durable, append-only log of every applied fix
    // (one row per edit), tagged with its origin ('auto' | 'manual'). Lets
    // the Analytics page show a real "issues fixed" count broken down by how
    // the fix was applied (#88 data-viz epic).
    "
    CREATE TABLE fix_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id TEXT NOT NULL,
        origin  TEXT NOT NULL,     -- 'auto' | 'manual'
        applied_at TEXT NOT NULL
    );
    ",
    // v8 — harness inventory + usage analytics (2026-08 spec)
    "
    CREATE TABLE harnesses (
        id           TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        detected     INTEGER NOT NULL DEFAULT 0,
        last_scan_at TEXT
    );
    CREATE TABLE harness_projects (
        harness         TEXT NOT NULL,
        path            TEXT NOT NULL,
        exists_on_disk  INTEGER NOT NULL DEFAULT 1,
        log_dir         TEXT,
        last_session_at TEXT,
        session_count   INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (harness, path)
    );
    CREATE TABLE artifacts (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        harness      TEXT NOT NULL,
        layer        TEXT NOT NULL,
        project_path TEXT,
        kind         TEXT NOT NULL,
        name         TEXT NOT NULL,
        path         TEXT NOT NULL,
        plugin_name  TEXT,
        description  TEXT,
        bytes        INTEGER NOT NULL DEFAULT 0,
        hash         TEXT NOT NULL,
        seen_at      TEXT NOT NULL,
        file_id      TEXT
    );
    -- NULL project_path (global/plugin layers) must still collide, so the
    -- identity is indexed over coalesce() rather than a plain UNIQUE clause.
    CREATE UNIQUE INDEX idx_artifacts_identity
        ON artifacts(harness, layer, coalesce(project_path,''), kind, name, path);
    CREATE TABLE sessions (
        id            TEXT PRIMARY KEY,
        harness       TEXT NOT NULL,
        project_path  TEXT NOT NULL,
        log_path      TEXT NOT NULL,
        started_at    TEXT,
        ended_at      TEXT,
        turns         INTEGER NOT NULL DEFAULT 0,
        input_tokens  INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        model         TEXT,
        byte_offset   INTEGER NOT NULL DEFAULT 0,
        -- Sub-agent transcripts (`<session>/subagents/agent-<id>.jsonl`) are
        -- sessions of their own; this links them to the session that spawned
        -- them. NULL for a top-level session, so project/session counts read
        -- `parent_session_id IS NULL`.
        parent_session_id TEXT,
        -- Last assistant `message.id` indexed in this log. Claude Code writes
        -- one record per content block with a repeated id and repeated usage,
        -- so the next incremental pass is seeded with this to avoid counting a
        -- straddling message's turn and tokens twice.
        last_message_id   TEXT
    );
    CREATE INDEX idx_sessions_parent ON sessions(harness, parent_session_id);
    CREATE TABLE invocations (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        harness      TEXT NOT NULL,
        session_id   TEXT NOT NULL,
        tool_use_id  TEXT NOT NULL,
        project_path TEXT NOT NULL,
        ts           TEXT NOT NULL,
        tool_name    TEXT NOT NULL,
        kind         TEXT NOT NULL,
        target       TEXT NOT NULL,
        artifact_id  INTEGER REFERENCES artifacts(id) ON DELETE SET NULL,
        duration_ms  INTEGER,
        is_error     INTEGER NOT NULL DEFAULT 0,
        turn_tokens  INTEGER
    );
    CREATE INDEX idx_invocations_session ON invocations(session_id);
    CREATE INDEX idx_invocations_target ON invocations(harness, kind, target, ts);
    CREATE INDEX idx_invocations_project ON invocations(harness, project_path, ts);
    CREATE INDEX idx_invocations_artifact_ts ON invocations(artifact_id, ts);
    -- Re-indexing a log replays lines: the harness tool_use id makes each
    -- invocation idempotent.
    CREATE UNIQUE INDEX idx_invocations_tool_use
        ON invocations(harness, session_id, tool_use_id);
    CREATE TABLE usage_stats (
        harness         TEXT NOT NULL,
        kind            TEXT NOT NULL,
        target          TEXT NOT NULL,
        artifact_id     INTEGER,
        total           INTEGER NOT NULL,
        sessions        INTEGER NOT NULL,
        last_used       TEXT,
        error_rate      REAL NOT NULL,
        avg_turn_tokens REAL,
        count_30d       INTEGER NOT NULL,
        count_prev_30d  INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX idx_usage_stats_identity
        ON usage_stats(harness, kind, target, coalesce(artifact_id,-1));
    CREATE TABLE scan_diagnostics (
        scan_id       INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        harness       TEXT NOT NULL,
        skipped_lines INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (scan_id, harness)
    );
    ",
    // v9 — the single scan folder became a list of extra folders. A pre-v9
    // install keeps scanning what it always did: the old folder is carried
    // over as the first entry of `extra_scan_folders`.
    "
    INSERT OR IGNORE INTO settings(key, value)
        SELECT 'extra_scan_folders', json_array(value) FROM settings WHERE key='scan_folder';
    DELETE FROM settings WHERE key='scan_folder';
    ",
];

/// Apply any migrations not yet applied. Idempotent.
pub fn migrate(conn: &Connection) -> rusqlite::Result<()> {
    // `foreign_keys` is per-connection, so every caller that reaches migrate()
    // gets enforcement — not just the ones going through open_and_migrate.
    // Must run outside a transaction to take effect.
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    let applied: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    for (i, sql) in MIGRATIONS.iter().enumerate() {
        if (i as i64) < applied {
            continue;
        }
        // A batch and its version bump land together, or not at all.
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(sql)?;
        tx.pragma_update(None, "user_version", (i as i64) + 1)?;
        tx.commit()?;
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

/// In-memory, fully migrated connection for tests.
#[cfg(test)]
pub fn test_conn() -> Connection {
    let conn = Connection::open_in_memory().expect("open in-memory db");
    migrate(&conn).expect("migrate in-memory db");
    conn
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Number of migrations that existed before v9. Hard-coded on purpose:
    /// the legacy-settings test has to stop exactly at the schema v9 upgrades
    /// from, not at "one before whatever is newest".
    const V8: usize = 8;

    #[test]
    fn v9_carries_the_legacy_scan_folder_into_extra_scan_folders() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        for sql in &MIGRATIONS[..V8] {
            conn.execute_batch(sql).unwrap();
        }
        conn.pragma_update(None, "user_version", V8 as i64).unwrap();
        conn.execute(
            "INSERT INTO settings(key, value) VALUES('scan_folder', '/x')",
            [],
        )
        .unwrap();

        migrate(&conn).unwrap();

        let folders: String = conn
            .query_row(
                "SELECT value FROM settings WHERE key='extra_scan_folders'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(folders, r#"["/x"]"#);
        let legacy: i64 = conn
            .query_row(
                "SELECT count(*) FROM settings WHERE key='scan_folder'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(legacy, 0, "the legacy key must not linger");
    }

    #[test]
    fn v9_is_a_no_op_without_a_legacy_scan_folder() {
        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        let n: i64 = conn
            .query_row(
                "SELECT count(*) FROM settings WHERE key='extra_scan_folders'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(n, 0);
    }

    #[test]
    fn migrations_create_schema_and_are_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();

        let version: i64 = conn
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .unwrap();
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
        let version_again: i64 = conn
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(version_again, MIGRATIONS.len() as i64);
    }

    #[test]
    fn migration_2_adds_kind_and_rule_id() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        // rules.kind exists and defaults to 'deterministic'
        conn.execute(
            "INSERT INTO rules(id, source, severity, title) VALUES('x', 'anthropic', 'hi', 'X')",
            [],
        )
        .unwrap();
        let kind: String = conn
            .query_row("SELECT kind FROM rules WHERE id = 'x'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(kind, "deterministic");
        // issues.rule_id exists and is nullable (issues.file_id has a FK to
        // files(id), which is enforced by default in this build, so a
        // parent project + file row is required first)
        conn.execute(
            "INSERT INTO projects(id, name, root_path) VALUES('p', 'P', '/p')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files(id, project_id, path, kind) VALUES('f', 'p', '/p/f.md', 'md')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO issues(file_id, severity, source, title, why) VALUES('f', 'hi', 'custom', 'T', 'W')",
            [],
        )
        .unwrap();
        let rule_id: Option<String> = conn
            .query_row("SELECT rule_id FROM issues LIMIT 1", [], |r| r.get(0))
            .unwrap();
        assert_eq!(rule_id, None);
    }

    #[test]
    fn migration_3_adds_content_hash() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        conn.execute(
            "INSERT INTO projects(id, name, root_path) VALUES('p', 'P', '/p')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files(id, project_id, path, kind, content_hash) VALUES('f', 'p', '/p/f.md', 'md', 'abc123')",
            [],
        )
        .unwrap();
        let hash: Option<String> = conn
            .query_row("SELECT content_hash FROM files WHERE id = 'f'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(hash.as_deref(), Some("abc123"));

        // Rows written before this migration have no hash — treated as
        // "unknown", never as a match.
        conn.execute(
            "INSERT INTO files(id, project_id, path, kind) VALUES('g', 'p', '/p/g.md', 'md')",
            [],
        )
        .unwrap();
        let missing: Option<String> = conn
            .query_row("SELECT content_hash FROM files WHERE id = 'g'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(missing, None);
    }

    #[test]
    fn migration_adds_project_logo_column() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        // A column that only exists after migration 5.
        conn.execute("UPDATE projects SET logo = 'x' WHERE 1=0", [])
            .expect("logo column should exist");
    }

    #[test]
    fn harness_tables_exist_after_migration() {
        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        for table in [
            "harnesses",
            "harness_projects",
            "artifacts",
            "sessions",
            "invocations",
            "usage_stats",
            "scan_diagnostics",
        ] {
            let n: i64 = conn
                .query_row(
                    "SELECT count(*) FROM sqlite_master WHERE type='table' AND name=?1",
                    [table],
                    |r| r.get(0),
                )
                .unwrap();
            assert_eq!(n, 1, "missing table {table}");
        }
        // Sub-agent transcripts hang off their parent session, and the turn
        // dedupe resumes from the last message id.
        conn.execute(
            "INSERT INTO sessions(id, harness, project_path, log_path, parent_session_id, last_message_id)
             VALUES('agent-abc', 'claude_code', '/p', '/p/l.jsonl', '0001-session', 'msg_1')",
            [],
        )
        .unwrap();
        let row: (Option<String>, Option<String>) = conn
            .query_row(
                "SELECT parent_session_id, last_message_id FROM sessions WHERE id='agent-abc'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(row, (Some("0001-session".into()), Some("msg_1".into())));
        for index in [
            "idx_artifacts_identity",
            "idx_invocations_tool_use",
            "idx_invocations_artifact_ts",
            "idx_usage_stats_identity",
            "idx_sessions_parent",
        ] {
            let n: i64 = conn
                .query_row(
                    "SELECT count(*) FROM sqlite_master WHERE type='index' AND name=?1",
                    [index],
                    |r| r.get(0),
                )
                .unwrap();
            assert_eq!(n, 1, "missing index {index}");
        }
    }

    #[test]
    fn test_conn_enforces_foreign_keys() {
        let conn = test_conn();
        let on: i64 = conn
            .query_row("PRAGMA foreign_keys", [], |r| r.get(0))
            .unwrap();
        assert_eq!(
            on, 1,
            "foreign key enforcement must be on for this connection"
        );
    }

    #[test]
    fn global_artifacts_with_null_project_path_share_one_identity() {
        let conn = test_conn();
        let insert = "INSERT INTO artifacts(harness, layer, project_path, kind, name, path, bytes, hash, seen_at)
             VALUES('claude_code', 'global', NULL, 'skill', 'adapt', '/g/skills/adapt/SKILL.md', 12, 'h', '2026-08-21T00:00:00Z')";
        conn.execute(insert, []).unwrap();
        let err = conn
            .execute(insert, [])
            .expect_err("second identical global artifact must violate uniqueness");
        assert!(
            err.to_string().contains("UNIQUE"),
            "unexpected error: {err}"
        );
    }
}
