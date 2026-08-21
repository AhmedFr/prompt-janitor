//! Persistence for harness inventory + usage. Pure SQL over the tables from
//! the harness migration; no harness-specific knowledge.
//!
//! Two invariants shape every statement here:
//!
//! * **Identity is a tuple, not a rowid.** Artifacts are upserted on
//!   `(harness, layer, coalesce(project_path,''), kind, name, path)` and
//!   invocations on `(harness, session_id, tool_use_id)`, so a rescan re-reads
//!   the same rows instead of replacing them — links, history and foreign keys
//!   survive.
//! * **Scans are incremental.** A pass carries only what it read since the
//!   cursor, so sessions merge (`MIN`/`MAX`/`+=`) rather than overwrite —
//!   except after a reset, where the log was re-read from zero and the batch is
//!   authoritative.

use std::collections::BTreeSet;

use rusqlite::{params, Connection, OptionalExtension};

use crate::harness::model::{Artifact, ProjectRef, UsageBatch, UsageCursor};
use crate::harness::time::{epoch_ms, iso_from_epoch};
use crate::harness::Scope;

pub fn upsert_harness(
    conn: &Connection,
    id: &str,
    display_name: &str,
    detected: bool,
    now: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO harnesses(id, display_name, detected, last_scan_at) VALUES(?1, ?2, ?3, ?4)
         ON CONFLICT(id) DO UPDATE SET
           display_name = excluded.display_name,
           detected     = excluded.detected,
           last_scan_at = excluded.last_scan_at",
        params![id, display_name, detected as i64, now],
    )?;
    Ok(())
}

pub fn upsert_projects(conn: &Connection, projects: &[ProjectRef]) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;
    {
        let mut st = tx.prepare(
            "INSERT INTO harness_projects(harness, path, exists_on_disk, log_dir)
             VALUES(?1, ?2, ?3, ?4)
             ON CONFLICT(harness, path) DO UPDATE SET
               exists_on_disk = excluded.exists_on_disk,
               log_dir        = excluded.log_dir",
        )?;
        for p in projects {
            st.execute(params![p.harness, p.path, p.exists as i64, p.log_dir])?;
        }
    }
    tx.commit()
}

/// Upserts `artifacts` of `harness` within `scope` on the identity tuple, then
/// deletes the rows in that scope this scan did not see (`seen_at <> now`).
///
/// Never delete-then-insert: `artifacts.id` is referenced by
/// `invocations.artifact_id`, so a rewrite would break every link (and, with
/// `ON DELETE SET NULL`, silently lose usage history). Returns rows upserted.
pub fn replace_artifacts(
    conn: &Connection,
    harness: &str,
    scope: &Scope,
    artifacts: &[Artifact],
    now: &str,
) -> rusqlite::Result<usize> {
    let tx = conn.unchecked_transaction()?;
    let mut n = 0;
    {
        // The conflict target repeats the expression of `idx_artifacts_identity`
        // so a NULL `project_path` (global/plugin layers) still collides.
        let mut st = tx.prepare(
            "INSERT INTO artifacts(harness, layer, project_path, kind, name, path, plugin_name,
                                   description, bytes, hash, seen_at, file_id)
             VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11,
                    CASE WHEN ?4 = 'rule' THEN ?6 ELSE NULL END)
             ON CONFLICT(harness, layer, coalesce(project_path,''), kind, name, path)
             DO UPDATE SET
               plugin_name = excluded.plugin_name,
               description = excluded.description,
               bytes       = excluded.bytes,
               hash        = excluded.hash,
               seen_at     = excluded.seen_at,
               file_id     = excluded.file_id",
        )?;
        for a in artifacts {
            n += st.execute(params![
                a.harness,
                a.layer.as_str(),
                a.project_path,
                a.kind.as_str(),
                a.name,
                a.path,
                a.plugin_name,
                a.description,
                a.bytes as i64,
                a.hash,
                now,
            ])?;
        }
    }
    match scope {
        Scope::Global => tx.execute(
            "DELETE FROM artifacts
             WHERE harness = ?1 AND layer IN ('global','plugin') AND seen_at <> ?2",
            params![harness, now],
        )?,
        Scope::Project(p) => tx.execute(
            "DELETE FROM artifacts
             WHERE harness = ?1 AND layer = 'project' AND project_path = ?2 AND seen_at <> ?3",
            params![harness, p, now],
        )?,
    };
    tx.commit()?;
    Ok(n)
}

/// How many artifacts the store already holds for `harness` within `scope`.
/// The scan asks before rewriting a scope that inventoried to nothing: an
/// existing project that suddenly has no artifacts was almost certainly
/// unreadable this pass, and a rewrite would delete a live inventory.
pub fn count_artifacts(conn: &Connection, harness: &str, scope: &Scope) -> rusqlite::Result<i64> {
    match scope {
        Scope::Global => conn.query_row(
            "SELECT count(*) FROM artifacts WHERE harness = ?1 AND layer IN ('global','plugin')",
            params![harness],
            |r| r.get(0),
        ),
        Scope::Project(p) => conn.query_row(
            "SELECT count(*) FROM artifacts
              WHERE harness = ?1 AND layer = 'project' AND project_path = ?2",
            params![harness, p],
            |r| r.get(0),
        ),
    }
}

/// Where the last sweep stopped in every known log, plus the last assistant
/// `message.id` seen in it — a message split across two passes must not be
/// counted twice, so the dedupe seed has to survive a restart.
pub fn load_cursor(conn: &Connection, harness: &str) -> rusqlite::Result<UsageCursor> {
    let mut st = conn
        .prepare("SELECT log_path, byte_offset, last_message_id FROM sessions WHERE harness=?1")?;
    let rows = st.query_map(params![harness], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, i64>(1)?.max(0) as u64,
            r.get::<_, Option<String>>(2)?,
        ))
    })?;
    let mut cursor = UsageCursor::default();
    for row in rows {
        let (path, offset, last) = row?;
        cursor.offsets.insert(path.clone(), offset);
        if let Some(id) = last {
            cursor.last_message_ids.insert(path, id);
        }
    }
    Ok(cursor)
}

/// Applies one indexing pass.
///
/// Sessions flagged in `batch.reset_sessions` had their log truncated or
/// rotated and were re-read from zero: their invocations are dropped and their
/// counters overwritten. Every other session merges into what is already
/// stored. Invocations are idempotent on their harness tool_use id, and
/// `orphan_results` resolve against rows persisted by an earlier pass.
pub fn store_usage(
    conn: &Connection,
    batch: &UsageBatch,
    cursor: &UsageCursor,
) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;
    let harnesses: BTreeSet<&str> = batch
        .sessions
        .iter()
        .map(|s| s.harness.as_str())
        .chain(batch.invocations.iter().map(|i| i.harness.as_str()))
        .chain(batch.orphan_results.iter().map(|o| o.harness.as_str()))
        .collect();
    // Every harness this pass touched, including ones reached only through a
    // reset: wiping a session changes its project's counts too, so the recount
    // at the end has to cover them.
    let mut recount_harnesses: BTreeSet<String> =
        harnesses.iter().map(|h| (*h).to_string()).collect();

    for id in &batch.reset_sessions {
        let incoming = batch.sessions.iter().find(|s| &s.id == id);
        // A session id is only unique within a harness, so the wipe must name
        // one: the batch knows it, and for a log truncated to nothing the
        // stored row does.
        let harness = match incoming {
            Some(s) => Some(s.harness.clone()),
            None => tx
                .query_row(
                    "SELECT harness FROM sessions WHERE id = ?1",
                    params![id],
                    |r| r.get::<_, String>(0),
                )
                .optional()?
                // Never persisted as a session (only its invocations were):
                // an unambiguous batch still names the harness.
                .or_else(|| match harnesses.len() {
                    1 => harnesses.iter().next().map(|h| (*h).to_string()),
                    _ => None,
                }),
        };
        let Some(harness) = harness else { continue };
        recount_harnesses.insert(harness.clone());
        tx.execute(
            "DELETE FROM invocations WHERE harness = ?1 AND session_id = ?2",
            params![harness, id],
        )?;
        if incoming.is_some() {
            continue; // the session upsert below overwrites its counters
        }
        // Nothing left in the log: zero the row and re-anchor it to the cursor.
        let log_path: Option<String> = tx
            .query_row(
                "SELECT log_path FROM sessions WHERE harness = ?1 AND id = ?2",
                params![harness, id],
                |r| r.get(0),
            )
            .optional()?;
        let offset = log_path
            .and_then(|p| cursor.offsets.get(&p).copied())
            .unwrap_or(0) as i64;
        tx.execute(
            "UPDATE sessions SET turns = 0, input_tokens = 0, output_tokens = 0,
               started_at = NULL, ended_at = NULL, last_message_id = NULL, byte_offset = ?3
             WHERE harness = ?1 AND id = ?2",
            params![harness, id, offset],
        )?;
    }

    {
        const COLUMNS: &str =
            "INSERT INTO sessions(id, harness, project_path, log_path, started_at,
                 ended_at, turns, input_tokens, output_tokens, model, byte_offset,
                 parent_session_id, last_message_id)
             VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
             ON CONFLICT(id) DO UPDATE SET ";
        // An incremental pass describes only the range it read, so the stored
        // row keeps the wider bounds and accumulates the counters.
        let mut merge = tx.prepare(&format!(
            "{COLUMNS}
               started_at = CASE WHEN sessions.started_at IS NULL
                                   OR (excluded.started_at IS NOT NULL
                                       AND excluded.started_at < sessions.started_at)
                                 THEN excluded.started_at ELSE sessions.started_at END,
               ended_at   = CASE WHEN excluded.ended_at IS NOT NULL
                                   AND (sessions.ended_at IS NULL
                                        OR excluded.ended_at > sessions.ended_at)
                                 THEN excluded.ended_at ELSE sessions.ended_at END,
               turns         = sessions.turns + excluded.turns,
               input_tokens  = sessions.input_tokens + excluded.input_tokens,
               output_tokens = sessions.output_tokens + excluded.output_tokens,
               model             = COALESCE(sessions.model, excluded.model),
               log_path          = excluded.log_path,
               -- Two sessions can share a log; the one indexed second must not
               -- rewind the cursor to where its own range happened to end.
               byte_offset       = max(excluded.byte_offset, sessions.byte_offset),
               parent_session_id = COALESCE(excluded.parent_session_id, sessions.parent_session_id),
               last_message_id   = COALESCE(excluded.last_message_id, sessions.last_message_id)"
        ))?;
        // After a reset the log was re-read whole, so the batch is the session.
        let mut overwrite = tx.prepare(&format!(
            "{COLUMNS}
               started_at        = excluded.started_at,
               ended_at          = excluded.ended_at,
               turns             = excluded.turns,
               input_tokens      = excluded.input_tokens,
               output_tokens     = excluded.output_tokens,
               model             = COALESCE(excluded.model, sessions.model),
               project_path      = excluded.project_path,
               log_path          = excluded.log_path,
               byte_offset       = excluded.byte_offset,
               parent_session_id = excluded.parent_session_id,
               last_message_id   = excluded.last_message_id"
        ))?;
        for s in &batch.sessions {
            let offset = cursor.offsets.get(&s.log_path).copied().unwrap_or(0) as i64;
            let args = params![
                s.id,
                s.harness,
                s.project_path,
                s.log_path,
                s.started_at,
                s.ended_at,
                s.turns,
                s.input_tokens,
                s.output_tokens,
                s.model,
                offset,
                s.parent_session_id,
                s.last_message_id,
            ];
            if batch.reset_sessions.contains(&s.id) {
                overwrite.execute(args)?;
            } else {
                merge.execute(args)?;
            }
        }
    }

    {
        // Re-indexing a range replays lines; the tool_use id makes that a no-op.
        let mut ins = tx.prepare(
            "INSERT OR IGNORE INTO invocations(harness, session_id, tool_use_id, project_path, ts,
                                               tool_name, kind, target, duration_ms, is_error,
                                               turn_tokens)
             VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        )?;
        for i in &batch.invocations {
            ins.execute(params![
                i.harness,
                i.session_id,
                i.tool_use_id,
                i.project_path,
                i.ts,
                i.tool_name,
                i.kind.as_str(),
                i.target,
                i.duration_ms,
                i.is_error as i64,
                i.turn_tokens,
            ])?;
        }
    }

    for o in &batch.orphan_results {
        // The duration is measured against the stored `tool_use` timestamp —
        // the pass that saw the result never saw the call.
        let ts: Option<String> = tx
            .query_row(
                "SELECT ts FROM invocations WHERE harness=?1 AND session_id=?2 AND tool_use_id=?3",
                params![o.harness, o.session_id, o.tool_use_id],
                |r| r.get(0),
            )
            .optional()?;
        let Some(ts) = ts else { continue };
        let duration = epoch_ms(&ts).map(|use_ms| o.end_ms - use_ms);
        tx.execute(
            "UPDATE invocations SET is_error = ?4, duration_ms = COALESCE(?5, duration_ms)
             WHERE harness=?1 AND session_id=?2 AND tool_use_id=?3",
            params![
                o.harness,
                o.session_id,
                o.tool_use_id,
                o.is_error as i64,
                duration
            ],
        )?;
    }

    {
        // Sub-agent transcripts are sessions of their own; a project counts
        // only the top-level ones.
        let mut recount = tx.prepare(
            "UPDATE harness_projects SET
               session_count = (SELECT count(*) FROM sessions s
                                 WHERE s.harness = harness_projects.harness
                                   AND s.project_path = harness_projects.path
                                   AND s.parent_session_id IS NULL),
               last_session_at = (SELECT max(ended_at) FROM sessions s
                                   WHERE s.harness = harness_projects.harness
                                     AND s.project_path = harness_projects.path)
             WHERE harness = ?1",
        )?;
        for harness in &recount_harnesses {
            recount.execute(params![harness])?;
        }
    }
    tx.commit()
}

/// Binds invocations to the artifact they named, newest links only
/// (`artifact_id IS NULL`). Resolution mirrors what the harness itself does:
/// `plugin:name` binds to that plugin's copy, a bare name prefers the project
/// layer, then global, then plugin. Builtins name no artifact and stay NULL.
pub fn link_invocations_to_artifacts(conn: &Connection, harness: &str) -> rusqlite::Result<usize> {
    let kind_map = [
        ("skill", "skill"),
        ("agent", "agent"),
        ("mcp", "mcp_server"),
    ];
    let mut total = 0;
    let tx = conn.unchecked_transaction()?;
    for (inv_kind, art_kind) in kind_map {
        // Plugin-qualified: "plugin:name".
        total += tx.execute(
            "UPDATE invocations SET artifact_id = (
                SELECT a.id FROM artifacts a
                 WHERE a.harness = ?1 AND a.kind = ?2 AND a.layer = 'plugin'
                   AND a.plugin_name = substr(invocations.target, 1, instr(invocations.target, ':') - 1)
                   AND a.name = substr(invocations.target, instr(invocations.target, ':') + 1)
                 LIMIT 1)
             WHERE harness = ?1 AND kind = ?3 AND artifact_id IS NULL
               AND instr(target, ':') > 0
               AND EXISTS (
                SELECT 1 FROM artifacts a
                 WHERE a.harness = ?1 AND a.kind = ?2 AND a.layer = 'plugin'
                   AND a.plugin_name = substr(invocations.target, 1, instr(invocations.target, ':') - 1)
                   AND a.name = substr(invocations.target, instr(invocations.target, ':') + 1))",
            params![harness, art_kind, inv_kind],
        )?;
        // Bare name: project → global → plugin. The EXISTS mirrors the
        // subquery exactly so a no-match is left alone rather than written NULL
        // (and counted as a link).
        total += tx.execute(
            "UPDATE invocations SET artifact_id = (
                SELECT a.id FROM artifacts a
                 WHERE a.harness = ?1 AND a.kind = ?2 AND a.name = invocations.target
                   AND (a.layer <> 'project' OR a.project_path = invocations.project_path)
                 ORDER BY CASE a.layer WHEN 'project' THEN 0 WHEN 'global' THEN 1 ELSE 2 END, a.id
                 LIMIT 1)
             WHERE harness = ?1 AND kind = ?3 AND artifact_id IS NULL
               AND instr(target, ':') = 0
               AND EXISTS (
                SELECT 1 FROM artifacts a
                 WHERE a.harness = ?1 AND a.kind = ?2 AND a.name = invocations.target
                   AND (a.layer <> 'project' OR a.project_path = invocations.project_path))",
            params![harness, art_kind, inv_kind],
        )?;
    }
    tx.commit()?;
    Ok(total)
}

/// Rebuilds the per-target rollup for `harness` from `invocations`.
///
/// Grouped by `(kind, target, artifact_id)`: the same name can resolve to
/// different artifacts across projects, and the unlinked (builtin) rows share a
/// NULL. `avg_turn_tokens` averages — the column is the turn's cost, which
/// sibling tool calls of one message legitimately repeat.
pub fn rebuild_usage_stats(
    conn: &Connection,
    harness: &str,
    now_epoch_secs: i64,
) -> rusqlite::Result<()> {
    // `invocations.ts` is a fixed-width UTC RFC3339 string, so window bounds
    // compare lexicographically.
    let d30 = iso_from_epoch(now_epoch_secs - 30 * 86_400);
    let d60 = iso_from_epoch(now_epoch_secs - 60 * 86_400);
    let tx = conn.unchecked_transaction()?;
    tx.execute("DELETE FROM usage_stats WHERE harness=?1", params![harness])?;
    tx.execute(
        "INSERT INTO usage_stats(harness, kind, target, artifact_id, total, sessions, last_used,
                                 error_rate, avg_turn_tokens, count_30d, count_prev_30d)
         SELECT harness, kind, target, artifact_id, count(*), count(DISTINCT session_id), max(ts),
                avg(is_error), avg(turn_tokens),
                sum(CASE WHEN ts >= ?2 THEN 1 ELSE 0 END),
                sum(CASE WHEN ts >= ?3 AND ts < ?2 THEN 1 ELSE 0 END)
           FROM invocations WHERE harness=?1
          GROUP BY harness, kind, target, artifact_id",
        params![harness, d30, d60],
    )?;
    tx.commit()
}

pub fn record_diagnostics(
    conn: &Connection,
    scan_id: i64,
    harness: &str,
    skipped: u64,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO scan_diagnostics(scan_id, harness, skipped_lines) VALUES(?1, ?2, ?3)
         ON CONFLICT(scan_id, harness) DO UPDATE SET skipped_lines = excluded.skipped_lines",
        params![scan_id, harness, skipped as i64],
    )?;
    Ok(())
}

pub fn last_scan_id(conn: &Connection) -> rusqlite::Result<Option<i64>> {
    conn.query_row("SELECT max(id) FROM scans", [], |r| r.get(0))
        .optional()
        .map(Option::flatten)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::harness::claude_code::test_support::fixture_home;
    use crate::harness::claude_code::ClaudeCode;
    use crate::harness::model::{
        Invocation, InvocationKind, OrphanResult, SessionMeta, UsageBatch,
    };
    use crate::harness::time::epoch_ms;
    use crate::harness::{Harness, Scope};
    use crate::store::test_conn;
    use rusqlite::{params, Connection};

    /// Everything a scan does for one harness, up to (not including) linking.
    fn seed_fixture(conn: &Connection) -> (tempfile::TempDir, ClaudeCode, String) {
        let (guard, home) = fixture_home();
        let h = ClaudeCode::with_home(home.clone());
        let app = home.root.join("work/app").to_string_lossy().into_owned();
        upsert_harness(conn, h.id(), h.display_name(), true, "1").unwrap();
        upsert_projects(conn, &h.projects()).unwrap();
        replace_artifacts(
            conn,
            h.id(),
            &Scope::Global,
            &h.inventory(&Scope::Global),
            "1",
        )
        .unwrap();
        replace_artifacts(
            conn,
            h.id(),
            &Scope::Project(app.clone()),
            &h.inventory(&Scope::Project(app.clone())),
            "1",
        )
        .unwrap();
        (guard, h, app)
    }

    fn count(conn: &Connection, sql: &str) -> i64 {
        conn.query_row(sql, [], |r| r.get(0)).unwrap()
    }

    #[test]
    fn iso_roundtrip() {
        assert_eq!(iso_from_epoch(0), "1970-01-01T00:00:00.000Z");
        assert_eq!(
            iso_from_epoch(epoch_ms("2026-08-01T10:00:00.000Z").unwrap() / 1000),
            "2026-08-01T10:00:00.000Z"
        );
    }

    #[test]
    fn full_pipeline_persists_links_and_rolls_up() {
        let conn = test_conn();
        let (_g, h, app) = seed_fixture(&conn);

        let mut cursor = load_cursor(&conn, h.id()).unwrap();
        assert!(cursor.offsets.is_empty());
        let batch = h.index_usage(&mut cursor);
        store_usage(&conn, &batch, &cursor).unwrap();
        let linked = link_invocations_to_artifacts(&conn, h.id()).unwrap();
        assert_eq!(
            linked, 4,
            "adapt, reviewer, playwright, superpowers:brainstorming"
        );

        // The sub-agent transcript is a session of its own, namespaced by its
        // parent, and its invocations are stored with it.
        assert_eq!(count(&conn, "SELECT count(*) FROM sessions"), 2);
        assert_eq!(
            count(
                &conn,
                "SELECT count(*) FROM sessions WHERE parent_session_id = '0001-session'"
            ),
            1
        );
        assert_eq!(count(&conn, "SELECT count(*) FROM invocations"), 6);

        // 2026-08-02T00:00:00Z — one day after the fixture session.
        rebuild_usage_stats(&conn, h.id(), 1_785_628_800).unwrap();
        let (total, sessions, err, c30): (i64, i64, f64, i64) = conn
            .query_row(
                "SELECT total, sessions, error_rate, count_30d FROM usage_stats WHERE kind='mcp' AND target='playwright'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
            )
            .unwrap();
        assert_eq!((total, sessions, c30), (1, 1, 1));
        assert!((err - 1.0).abs() < f64::EPSILON);
        // One row per (kind, target, artifact_id): 4 linked + Bash + Read.
        assert_eq!(count(&conn, "SELECT count(*) FROM usage_stats"), 6);
        assert_eq!(
            count(
                &conn,
                "SELECT count(*) FROM usage_stats WHERE kind='builtin' AND artifact_id IS NULL"
            ),
            2
        );

        let unused = count(
            &conn,
            "SELECT count(*) FROM artifacts a LEFT JOIN usage_stats u ON u.artifact_id = a.id
             WHERE a.kind='skill' AND u.artifact_id IS NULL",
        );
        assert_eq!(unused, 2, "unused-skill and deploy have no invocations");

        // Second run: cursor persisted, nothing new, counts unchanged.
        let mut cursor2 = load_cursor(&conn, h.id()).unwrap();
        assert_eq!(
            cursor2.offsets.len(),
            2,
            "session log + sub-agent transcript"
        );
        assert_eq!(cursor2.last_message_ids.len(), 2, "turn dedupe resumes");
        let batch2 = h.index_usage(&mut cursor2);
        assert!(batch2.invocations.is_empty());
        store_usage(&conn, &batch2, &cursor2).unwrap();
        assert_eq!(count(&conn, "SELECT count(*) FROM invocations"), 6);
        let (turns, input): (i64, i64) = conn
            .query_row(
                "SELECT turns, input_tokens FROM sessions WHERE id='0001-session'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!((turns, input), (5, 330), "no double counting on re-index");

        // Only top-level sessions count toward a project.
        let sc: i64 = conn
            .query_row(
                "SELECT session_count FROM harness_projects WHERE path = ?1",
                [&app],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(sc, 1);
    }

    /// A rescan re-upserts the same artifacts: ids must survive so links and
    /// history stay attached.
    #[test]
    fn artifact_ids_are_stable_across_rescans() {
        let conn = test_conn();
        let (_g, h, app) = seed_fixture(&conn);
        let mut cursor = load_cursor(&conn, h.id()).unwrap();
        let batch = h.index_usage(&mut cursor);
        store_usage(&conn, &batch, &cursor).unwrap();
        link_invocations_to_artifacts(&conn, h.id()).unwrap();

        let before: Vec<(i64, String)> = conn
            .prepare("SELECT id, name FROM artifacts ORDER BY id")
            .unwrap()
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap();

        replace_artifacts(
            &conn,
            h.id(),
            &Scope::Global,
            &h.inventory(&Scope::Global),
            "2",
        )
        .unwrap();
        replace_artifacts(
            &conn,
            h.id(),
            &Scope::Project(app.clone()),
            &h.inventory(&Scope::Project(app.clone())),
            "2",
        )
        .unwrap();

        let after: Vec<(i64, String)> = conn
            .prepare("SELECT id, name FROM artifacts ORDER BY id")
            .unwrap()
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap();
        assert_eq!(before, after, "ids and rows are unchanged by a rescan");
        assert_eq!(
            count(
                &conn,
                "SELECT count(*) FROM invocations WHERE artifact_id IS NOT NULL"
            ),
            4,
            "links survive"
        );
        assert_eq!(
            count(&conn, "SELECT count(*) FROM artifacts WHERE seen_at='1'"),
            0
        );
    }

    #[test]
    fn replace_artifacts_is_scoped() {
        let conn = test_conn();
        let (_g, h, app) = seed_fixture(&conn);
        let before = count(&conn, "SELECT count(*) FROM artifacts");
        replace_artifacts(&conn, h.id(), &Scope::Project(app.clone()), &[], "2").unwrap();
        let after = count(
            &conn,
            "SELECT count(*) FROM artifacts WHERE layer='project'",
        );
        let global = count(
            &conn,
            "SELECT count(*) FROM artifacts WHERE layer IN ('global','plugin')",
        );
        assert_eq!(after, 0);
        assert!(global > 0 && global < before);
    }

    /// A `tool_result` whose `tool_use` was indexed in an earlier pass resolves
    /// against the stored row: duration is measured from the stored `ts`.
    #[test]
    fn orphan_result_updates_duration_and_error() {
        let conn = test_conn();
        let inv = Invocation {
            harness: "claude_code".into(),
            session_id: "s1".into(),
            tool_use_id: "t9".into(),
            project_path: "/p".into(),
            ts: "2026-08-01T10:00:20.000Z".into(),
            tool_name: "Bash".into(),
            kind: InvocationKind::Builtin,
            target: "Bash".into(),
            duration_ms: None,
            is_error: false,
            turn_tokens: Some(10),
        };
        let first = UsageBatch {
            sessions: vec![SessionMeta {
                harness: "claude_code".into(),
                id: "s1".into(),
                project_path: "/p".into(),
                log_path: "/logs/s1.jsonl".into(),
                ..Default::default()
            }],
            invocations: vec![inv],
            ..Default::default()
        };
        store_usage(&conn, &first, &UsageCursor::default()).unwrap();

        let second = UsageBatch {
            orphan_results: vec![OrphanResult {
                harness: "claude_code".into(),
                session_id: "s1".into(),
                tool_use_id: "t9".into(),
                end_ms: epoch_ms("2026-08-01T10:00:25.000Z").unwrap(),
                is_error: true,
            }],
            ..Default::default()
        };
        store_usage(&conn, &second, &UsageCursor::default()).unwrap();

        let (dur, err): (Option<i64>, bool) = conn
            .query_row(
                "SELECT duration_ms, is_error FROM invocations WHERE tool_use_id='t9'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(dur, Some(5000));
        assert!(err);
    }

    /// A truncated/rotated log is re-read from 0: the session's prior rows go
    /// away and its counters are overwritten, not added to.
    #[test]
    fn reset_session_wipes_invocations_and_overwrites_counters() {
        let conn = test_conn();
        let session = |turns, input| SessionMeta {
            harness: "claude_code".into(),
            id: "s1".into(),
            project_path: "/p".into(),
            log_path: "/logs/s1.jsonl".into(),
            started_at: Some("2026-08-01T10:00:00.000Z".into()),
            ended_at: Some("2026-08-01T10:00:20.000Z".into()),
            turns,
            input_tokens: input,
            ..Default::default()
        };
        let inv = |id: &str| Invocation {
            harness: "claude_code".into(),
            session_id: "s1".into(),
            tool_use_id: id.into(),
            project_path: "/p".into(),
            ts: "2026-08-01T10:00:01.000Z".into(),
            tool_name: "Bash".into(),
            kind: InvocationKind::Builtin,
            target: "Bash".into(),
            duration_ms: None,
            is_error: false,
            turn_tokens: Some(10),
        };
        let first = UsageBatch {
            sessions: vec![session(4, 100)],
            invocations: vec![inv("t1"), inv("t2")],
            ..Default::default()
        };
        store_usage(&conn, &first, &UsageCursor::default()).unwrap();
        assert_eq!(count(&conn, "SELECT count(*) FROM invocations"), 2);

        let mut cursor = UsageCursor::default();
        cursor.offsets.insert("/logs/s1.jsonl".into(), 42);
        let reset = UsageBatch {
            sessions: vec![session(1, 7)],
            invocations: vec![inv("t7")],
            reset_sessions: vec!["s1".into()],
            ..Default::default()
        };
        store_usage(&conn, &reset, &cursor).unwrap();

        let (turns, input, offset): (i64, i64, i64) = conn
            .query_row(
                "SELECT turns, input_tokens, byte_offset FROM sessions WHERE id='s1'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .unwrap();
        assert_eq!((turns, input, offset), (1, 7, 42), "counters overwritten");
        assert_eq!(
            count(&conn, "SELECT count(*) FROM invocations"),
            1,
            "prior rows wiped"
        );
        assert_eq!(
            count(
                &conn,
                "SELECT count(*) FROM invocations WHERE tool_use_id='t7'"
            ),
            1
        );
    }

    /// A log truncated to empty produces a reset with no session in the batch:
    /// its rows still go, and its counters are zeroed.
    #[test]
    fn reset_without_a_session_in_the_batch_zeroes_the_row() {
        let conn = test_conn();
        let first = UsageBatch {
            sessions: vec![SessionMeta {
                harness: "claude_code".into(),
                id: "s1".into(),
                project_path: "/p".into(),
                log_path: "/logs/s1.jsonl".into(),
                turns: 3,
                input_tokens: 30,
                output_tokens: 9,
                last_message_id: Some("m3".into()),
                ..Default::default()
            }],
            invocations: vec![Invocation {
                harness: "claude_code".into(),
                session_id: "s1".into(),
                tool_use_id: "t1".into(),
                project_path: "/p".into(),
                ts: "2026-08-01T10:00:01.000Z".into(),
                tool_name: "Bash".into(),
                kind: InvocationKind::Builtin,
                target: "Bash".into(),
                duration_ms: None,
                is_error: false,
                turn_tokens: Some(10),
            }],
            ..Default::default()
        };
        store_usage(&conn, &first, &UsageCursor::default()).unwrap();

        let empty = UsageBatch {
            reset_sessions: vec!["s1".into()],
            ..Default::default()
        };
        store_usage(&conn, &empty, &UsageCursor::default()).unwrap();

        let (turns, input, offset, last): (i64, i64, i64, Option<String>) = conn
            .query_row(
                "SELECT turns, input_tokens, byte_offset, last_message_id FROM sessions WHERE id='s1'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
            )
            .unwrap();
        assert_eq!((turns, input, offset, last), (0, 0, 0, None));
        assert_eq!(count(&conn, "SELECT count(*) FROM invocations"), 0);
    }

    /// A batch that carries nothing but a reset still changed the world: the
    /// session it wiped belonged to a project whose rollup is now stale.
    #[test]
    fn a_reset_only_batch_recounts_the_projects_it_touched() {
        let conn = test_conn();
        upsert_projects(
            &conn,
            &[ProjectRef {
                harness: "claude_code".into(),
                path: "/p".into(),
                exists: true,
                log_dir: None,
            }],
        )
        .unwrap();
        let first = UsageBatch {
            sessions: vec![SessionMeta {
                harness: "claude_code".into(),
                id: "s1".into(),
                project_path: "/p".into(),
                log_path: "/logs/s1.jsonl".into(),
                ended_at: Some("2026-08-01T10:00:20.000Z".into()),
                turns: 3,
                ..Default::default()
            }],
            ..Default::default()
        };
        store_usage(&conn, &first, &UsageCursor::default()).unwrap();
        // A stale rollup, as a scan that never recounted would leave it.
        conn.execute(
            "UPDATE harness_projects SET session_count = 99 WHERE path = '/p'",
            [],
        )
        .unwrap();

        let reset_only = UsageBatch {
            reset_sessions: vec!["s1".into()],
            ..Default::default()
        };
        store_usage(&conn, &reset_only, &UsageCursor::default()).unwrap();

        let (n, last): (i64, Option<String>) = conn
            .query_row(
                "SELECT session_count, last_session_at FROM harness_projects WHERE path = '/p'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(n, 1, "the recount must reach a reset-only harness");
        assert_eq!(last, None, "the wiped session no longer dates the project");
    }

    /// Sessions share a log, and a pass that read less of it than an earlier
    /// one must not rewind the cursor — the skipped bytes would be re-indexed.
    #[test]
    fn a_merge_never_rewinds_the_stored_byte_offset() {
        let conn = test_conn();
        let session = || SessionMeta {
            harness: "claude_code".into(),
            id: "s1".into(),
            project_path: "/p".into(),
            log_path: "/logs/s1.jsonl".into(),
            turns: 1,
            ..Default::default()
        };
        let at = |offset: u64| {
            let mut c = UsageCursor::default();
            c.offsets.insert("/logs/s1.jsonl".into(), offset);
            c
        };
        let batch = || UsageBatch {
            sessions: vec![session()],
            ..Default::default()
        };
        store_usage(&conn, &batch(), &at(500)).unwrap();
        store_usage(&conn, &batch(), &at(100)).unwrap();

        assert_eq!(
            count(&conn, "SELECT byte_offset FROM sessions WHERE id='s1'"),
            500
        );
    }

    /// A reset only touches its own harness: a same-named session elsewhere
    /// keeps its rows.
    #[test]
    fn reset_is_harness_scoped() {
        let conn = test_conn();
        let batch_for = |harness: &str, id: &str| UsageBatch {
            sessions: vec![SessionMeta {
                harness: harness.into(),
                id: id.into(),
                project_path: "/p".into(),
                log_path: format!("/logs/{harness}.jsonl"),
                turns: 1,
                ..Default::default()
            }],
            invocations: vec![Invocation {
                harness: harness.into(),
                session_id: id.into(),
                tool_use_id: "t1".into(),
                project_path: "/p".into(),
                ts: "2026-08-01T10:00:01.000Z".into(),
                tool_name: "Bash".into(),
                kind: InvocationKind::Builtin,
                target: "Bash".into(),
                duration_ms: None,
                is_error: false,
                turn_tokens: Some(10),
            }],
            ..Default::default()
        };
        // Two harnesses, same session id — `sessions.id` is a bare PK, so the
        // ids differ; the invocations deliberately share one.
        store_usage(
            &conn,
            &batch_for("claude_code", "a"),
            &UsageCursor::default(),
        )
        .unwrap();
        store_usage(&conn, &batch_for("other", "b"), &UsageCursor::default()).unwrap();
        conn.execute("UPDATE invocations SET session_id='shared'", [])
            .unwrap();

        let mut reset = batch_for("claude_code", "a");
        reset.invocations.clear();
        reset.reset_sessions = vec!["shared".into()];
        // The wipe must find its harness from the batch, not the sessions table.
        store_usage(&conn, &reset, &UsageCursor::default()).unwrap();
        assert_eq!(
            count(
                &conn,
                "SELECT count(*) FROM invocations WHERE harness='other'"
            ),
            1,
            "the other harness is untouched"
        );
        assert_eq!(
            count(
                &conn,
                "SELECT count(*) FROM invocations WHERE harness='claude_code'"
            ),
            0
        );
    }

    /// Skills resolve project → global → plugin; a `plugin:skill` target binds
    /// to that plugin's copy; builtins are never linked.
    #[test]
    fn linking_prefers_the_project_layer_and_skips_builtins() {
        let conn = test_conn();
        let (_g, h, app) = seed_fixture(&conn);
        let mut cursor = load_cursor(&conn, h.id()).unwrap();
        let batch = h.index_usage(&mut cursor);
        store_usage(&conn, &batch, &cursor).unwrap();
        // A project-layer `adapt` must win over the global one.
        conn.execute(
            "INSERT INTO artifacts(harness, layer, project_path, kind, name, path, bytes, hash, seen_at)
             VALUES('claude_code','project',?1,'skill','adapt',?2,0,'h','1')",
            params![app, format!("{app}/.claude/skills/adapt/SKILL.md")],
        )
        .unwrap();
        link_invocations_to_artifacts(&conn, h.id()).unwrap();

        let layer: String = conn
            .query_row(
                "SELECT a.layer FROM invocations i JOIN artifacts a ON a.id = i.artifact_id
                 WHERE i.target='adapt'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(layer, "project");
        let plugin: Option<String> = conn
            .query_row(
                "SELECT a.plugin_name FROM invocations i JOIN artifacts a ON a.id = i.artifact_id
                 WHERE i.target='superpowers:brainstorming'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(plugin.as_deref(), Some("superpowers"));
        assert_eq!(
            count(
                &conn,
                "SELECT count(*) FROM invocations WHERE kind='builtin' AND artifact_id IS NOT NULL"
            ),
            0
        );
        // Re-running links nothing new.
        assert_eq!(link_invocations_to_artifacts(&conn, h.id()).unwrap(), 0);
    }

    #[test]
    fn diagnostics_upsert_per_scan_and_harness() {
        let conn = test_conn();
        conn.execute("INSERT INTO scans(started_at) VALUES('1')", [])
            .unwrap();
        let scan = last_scan_id(&conn).unwrap().unwrap();
        record_diagnostics(&conn, scan, "claude_code", 3).unwrap();
        record_diagnostics(&conn, scan, "claude_code", 7).unwrap();
        let (n, skipped): (i64, i64) = conn
            .query_row(
                "SELECT count(*), max(skipped_lines) FROM scan_diagnostics",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!((n, skipped), (1, 7));
    }
}
