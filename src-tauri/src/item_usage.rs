//! One item's usage over a window: uses and errors per day, and which projects
//! used it — the viewer's Usage tab (spec §6.3). Counts every invocation that
//! resolved to the artifact, sub-agent ones included (the work happened).

use std::collections::HashMap;

use rusqlite::{params, Connection};

use crate::harness_query::{last_component, window_calendar_days};

/// The longest daily series: a year and a leap day.
const MAX_WINDOW_DAYS: u32 = 366;

#[derive(Debug, Clone, PartialEq, serde::Serialize, specta::Type)]
pub struct UsageDay {
    /// `YYYY-MM-DD`, UTC.
    pub day: String,
    pub uses: u32,
    pub errors: u32,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, specta::Type)]
pub struct ProjectUses {
    pub path: String,
    pub name: String,
    pub uses: u32,
    pub sessions: u32,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, specta::Type)]
pub struct ArtifactUsage {
    pub window_days: u32,
    /// Oldest day first, zero-filled.
    pub per_day: Vec<UsageDay>,
    /// Busiest project first.
    pub by_project: Vec<ProjectUses>,
    pub avg_turn_tokens: Option<f64>,
}

fn as_u32(v: i64) -> u32 {
    v.clamp(0, u32::MAX as i64) as u32
}

pub fn artifact_usage(
    conn: &Connection,
    artifact_id: i32,
    now_epoch_secs: i64,
    window_days: u32,
) -> rusqlite::Result<ArtifactUsage> {
    let window_days = window_days.clamp(1, MAX_WINDOW_DAYS);
    let days = window_calendar_days(now_epoch_secs, window_days);
    let since = format!("{}T00:00:00Z", days[0]);

    let mut per_day_stmt = conn.prepare(
        "SELECT substr(ts, 1, 10) AS day, count(*), sum(is_error)
           FROM invocations WHERE artifact_id = ?1 AND ts >= ?2 GROUP BY day",
    )?;
    let mut by_day: HashMap<String, (u32, u32)> = HashMap::new();
    for row in per_day_stmt.query_map(params![artifact_id, since], |r| {
        Ok((
            r.get::<_, String>(0)?,
            as_u32(r.get(1)?),
            as_u32(r.get::<_, Option<i64>>(2)?.unwrap_or(0)),
        ))
    })? {
        let (day, uses, errors) = row?;
        by_day.insert(day, (uses, errors));
    }
    let per_day = days
        .into_iter()
        .map(|day| {
            let (uses, errors) = by_day.get(&day).copied().unwrap_or((0, 0));
            UsageDay { day, uses, errors }
        })
        .collect();

    let mut proj_stmt = conn.prepare(
        "SELECT rtrim(project_path, '/'), count(*), count(DISTINCT session_id)
           FROM invocations WHERE artifact_id = ?1 AND ts >= ?2
          GROUP BY rtrim(project_path, '/') ORDER BY count(*) DESC, 1",
    )?;
    let by_project = proj_stmt
        .query_map(params![artifact_id, since], |r| {
            let path: String = r.get(0)?;
            Ok(ProjectUses {
                name: last_component(&path),
                path,
                uses: as_u32(r.get(1)?),
                sessions: as_u32(r.get(2)?),
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    let avg_turn_tokens: Option<f64> = conn.query_row(
        "SELECT avg(turn_tokens) FROM invocations WHERE artifact_id = ?1 AND ts >= ?2",
        params![artifact_id, since],
        |r| r.get(0),
    )?;

    Ok(ArtifactUsage {
        window_days,
        per_day,
        by_project,
        avg_turn_tokens,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::test_conn;

    /// One artifact, three invocations over two days in two projects, one of them an error.
    fn seeded() -> (rusqlite::Connection, i32) {
        let conn = test_conn();
        conn.execute(
            "INSERT INTO artifacts(harness, layer, project_path, kind, name, path, bytes, hash, seen_at)
             VALUES('claude_code', 'global', NULL, 'skill', 'adapt', '/h/adapt/SKILL.md', 0, 'h', '2026-09-01T00:00:00Z')",
            [],
        )
        .unwrap();
        let id = conn.last_insert_rowid() as i32;
        for (ts, project, session, err, tokens) in [
            ("2026-09-25T10:00:00Z", "/code/web", "s1", 0, 1000),
            ("2026-09-25T11:00:00Z", "/code/web", "s1", 1, 3000),
            ("2026-09-26T09:00:00Z", "/code/api", "s2", 0, 2000),
        ] {
            insert_invocation(&conn, id, ts, project, session, err, tokens);
        }
        (conn, id)
    }

    fn insert_invocation(
        conn: &rusqlite::Connection,
        artifact_id: i32,
        ts: &str,
        project: &str,
        session: &str,
        is_error: i64,
        tokens: i64,
    ) {
        conn.execute(
            "INSERT INTO invocations(harness, session_id, tool_use_id, project_path, ts, tool_name, kind, target, artifact_id, is_error, turn_tokens)
             VALUES('claude_code', ?1, ?2, ?3, ?4, 'Skill', 'skill', 'adapt', ?5, ?6, ?7)",
            rusqlite::params![session, format!("{session}-{ts}"), project, ts, artifact_id, is_error, tokens],
        )
        .unwrap();
    }

    /// 2026-09-27T00:00:00Z
    const NOW: i64 = 1_790_467_200;

    #[test]
    fn counts_uses_and_errors_per_day_zero_filled() {
        let (conn, id) = seeded();
        let u = artifact_usage(&conn, id, NOW, 3).unwrap();
        assert_eq!(u.window_days, 3);
        let days: Vec<_> = u
            .per_day
            .iter()
            .map(|d| (d.day.as_str(), d.uses, d.errors))
            .collect();
        assert_eq!(
            days,
            vec![
                ("2026-09-25", 2, 1),
                ("2026-09-26", 1, 0),
                ("2026-09-27", 0, 0)
            ]
        );
    }

    #[test]
    fn splits_uses_by_project_busiest_first() {
        let (conn, id) = seeded();
        let u = artifact_usage(&conn, id, NOW, 30).unwrap();
        let split: Vec<_> = u
            .by_project
            .iter()
            .map(|p| (p.name.as_str(), p.uses, p.sessions))
            .collect();
        assert_eq!(split, vec![("web", 2, 1), ("api", 1, 1)]);
    }

    #[test]
    fn averages_tokens_over_the_window() {
        let (conn, id) = seeded();
        assert_eq!(
            artifact_usage(&conn, id, NOW, 30).unwrap().avg_turn_tokens,
            Some(2000.0)
        );
    }

    #[test]
    fn an_unused_artifact_has_a_flat_series_and_no_projects() {
        let (conn, _) = seeded();
        let u = artifact_usage(&conn, 9_999, NOW, 7).unwrap();
        assert_eq!(u.per_day.len(), 7);
        assert!(u.per_day.iter().all(|d| d.uses == 0));
        assert!(u.by_project.is_empty());
        assert_eq!(u.avg_turn_tokens, None);
    }

    #[test]
    fn the_window_is_capped_at_a_year() {
        let (conn, id) = seeded();
        assert_eq!(
            artifact_usage(&conn, id, NOW, 10_000)
                .unwrap()
                .per_day
                .len(),
            366
        );
    }
}
