//! Read models over the harness tables — the shapes the Setup and Analytics
//! screens render.
//!
//! Nothing here writes: a scan (`harness_scan`) fills `artifacts`,
//! `invocations`, `sessions` and the `usage_stats` rollup, and these queries
//! shape them for IPC. Three conventions run through every statement:
//!
//! * **Sessions are counted top-level only** (`parent_session_id IS NULL`).
//!   Sub-agent transcripts are sessions of their own, so counting them would
//!   inflate every project and harness total. Invocation-level aggregates keep
//!   counting sub-agent rows — the work really happened.
//! * **Grades come from the file grader**, joined in through
//!   `artifacts.file_id -> files.id` (both are the absolute path). An artifact
//!   the grader never saw simply has no grade.
//! * **Usage comes from the rollup**, keyed by `usage_stats.artifact_id`.
//!   Targets that resolved to no artifact (builtins) have no row here; they
//!   surface in the usage overview instead.

use std::collections::HashMap;

use rusqlite::{params, Connection, Row};

use crate::harness::model::{ArtifactKind, InvocationKind, Layer};
use crate::harness::time::iso_from_epoch;

/// One installed agent harness and how much of it we know about.
#[derive(Debug, Clone, PartialEq, serde::Serialize, specta::Type)]
pub struct HarnessInfo {
    pub id: String,
    pub display_name: String,
    pub detected: bool,
    pub last_scan_at: Option<String>,
    pub project_count: u32,
    /// Top-level sessions only — sub-agent transcripts are not user sessions.
    pub session_count: u32,
}

/// The rollup row for one artifact (`usage_stats`).
#[derive(Debug, Clone, PartialEq, serde::Serialize, specta::Type)]
pub struct UsageStat {
    pub total: u32,
    pub sessions: u32,
    pub last_used: Option<String>,
    pub error_rate: f64,
    pub avg_turn_tokens: Option<f64>,
    pub count_30d: u32,
    pub count_prev_30d: u32,
}

/// An inventoried artifact, with its grade (when the file grader saw it) and
/// its usage (when anything ever invoked it).
#[derive(Debug, Clone, PartialEq, serde::Serialize, specta::Type)]
pub struct ArtifactView {
    pub id: i32,
    pub harness: String,
    pub layer: Layer,
    pub kind: ArtifactKind,
    pub name: String,
    pub path: String,
    pub plugin_name: Option<String>,
    pub description: Option<String>,
    pub bytes: u32,
    pub grade: Option<String>,
    pub score: Option<u32>,
    pub file_id: Option<String>,
    pub usage: Option<UsageStat>,
}

/// A project the harness has seen, and everything configured inside it.
#[derive(Debug, Clone, PartialEq, serde::Serialize, specta::Type)]
pub struct ProjectSetup {
    pub harness: String,
    pub path: String,
    /// Last path component — what the UI labels the project with.
    pub name: String,
    pub exists: bool,
    pub session_count: u32,
    pub last_session_at: Option<String>,
    pub artifacts: Vec<ArtifactView>,
}

/// Everything the Setup screen renders in one round trip.
#[derive(Debug, Clone, PartialEq, serde::Serialize, specta::Type)]
pub struct SetupView {
    pub harnesses: Vec<HarnessInfo>,
    /// Global + plugin layers: the artifacts that apply everywhere.
    pub global: Vec<ArtifactView>,
    pub projects: Vec<ProjectSetup>,
}

/// One rule file in the stack that applies to a project, in load order.
#[derive(Debug, Clone, PartialEq, serde::Serialize, specta::Type)]
pub struct EffectiveRule {
    pub layer: Layer,
    pub path: String,
    pub name: String,
    pub grade: Option<String>,
    pub file_id: Option<String>,
}

/// One invoked target over the reporting window — the row the ranked usage
/// lists render.
#[derive(Debug, Clone, PartialEq, serde::Serialize, specta::Type)]
pub struct RankedTarget {
    pub kind: InvocationKind,
    pub target: String,
    /// The artifact the target resolved to, when it resolved to one at all —
    /// builtins and unlinked targets have none.
    pub artifact_id: Option<i32>,
    pub uses: u32,
    /// Distinct sessions the target was invoked in (sub-agent sessions count).
    pub sessions: u32,
    /// Share of invocations that returned an error, 0–1.
    pub error_rate: f64,
    /// Mean context tokens per turn, over the turns that recorded any.
    pub avg_turn_tokens: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, specta::Type)]
pub struct KindTotal {
    pub kind: InvocationKind,
    pub total: u32,
    pub avg_turn_tokens: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, specta::Type)]
pub struct ProjectSessions {
    pub path: String,
    pub name: String,
    pub sessions: u32,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, specta::Type)]
pub struct TargetRate {
    pub target: String,
    pub total: u32,
    pub error_rate: f64,
}

/// What the Analytics usage tab renders. Every aggregate is bounded by the
/// same `window_days`, so the four of them always describe one period.
#[derive(Debug, Clone, PartialEq, serde::Serialize, specta::Type)]
pub struct UsageOverview {
    /// The window every aggregate below was computed over, echoed back so the
    /// UI can label what it is showing.
    pub window_days: u32,
    /// Every `(kind, target)` invoked in the window, busiest first.
    pub ranked: Vec<RankedTarget>,
    /// Totals per invocation kind in `skill, agent, mcp, builtin` order —
    /// always four rows, zeroed for a kind the window holds nothing of.
    pub by_kind: Vec<KindTotal>,
    /// Top-level sessions started in the window, per project.
    pub sessions_per_project: Vec<ProjectSessions>,
    /// Error rate per MCP server over the window, busiest first.
    pub mcp_error_rates: Vec<TargetRate>,
}

/// Top-level sessions started on one calendar day (`YYYY-MM-DD`, UTC).
#[derive(Debug, Clone, PartialEq, serde::Serialize, specta::Type)]
pub struct DayCount {
    pub day: String,
    pub count: u32,
}

/// What one project's usage tab renders, over the same window as the
/// Analytics overview.
#[derive(Debug, Clone, PartialEq, serde::Serialize, specta::Type)]
pub struct ProjectUsage {
    /// Every `(kind, target)` invoked inside the project, busiest first.
    /// Sub-agent invocations count — they ran in this project's sessions.
    pub ranked: Vec<RankedTarget>,
    /// Top-level sessions per day, oldest day first — the activity sparkline.
    /// Zero-filled: one point per day of the window, so a quiet day is a zero
    /// the chart can draw rather than a gap it would interpolate across.
    pub sessions_per_day: Vec<DayCount>,
}

/// How many ranked rows one call returns at most. Nothing in the UI reads
/// past the busiest few dozen, so the rest is payload a Tauri round trip has
/// to serialize for nobody.
const RANKED_LIMIT: u32 = 500;

/// The longest daily series [`project_usage`] will build: a year and a leap
/// day. A caller asking for a decade would otherwise get a decade of points.
const MAX_WINDOW_DAYS: u32 = 366;

/// `skill, agent, mcp, builtin` — the order the UI legend lists kinds in.
const KIND_ORDER: [InvocationKind; 4] = [
    InvocationKind::Skill,
    InvocationKind::Agent,
    InvocationKind::Mcp,
    InvocationKind::Builtin,
];

/// `CASE <col> WHEN 'rule' THEN 0 …` so SQL can order artifacts by
/// [`ArtifactKind::ALL`] rather than alphabetically.
fn kind_order(col: &str) -> String {
    let mut sql = format!("CASE {col} ");
    for (i, kind) in ArtifactKind::ALL.iter().enumerate() {
        sql.push_str(&format!("WHEN '{}' THEN {i} ", kind.as_str()));
    }
    sql.push_str("ELSE 99 END");
    sql
}

/// Last path component, for labelling a project. Falls back to the whole path
/// (a root, or a path that ends in a separator).
fn last_component(path: &str) -> String {
    std::path::Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string())
}

/// `harnesses.last_scan_at` is written as epoch seconds; render it in the same
/// RFC3339 shape as every other timestamp the UI shows.
fn scan_stamp(raw: Option<String>) -> Option<String> {
    raw.map(|s| match s.parse::<i64>() {
        Ok(secs) => iso_from_epoch(secs),
        Err(_) => s,
    })
}

fn as_u32(v: i64) -> u32 {
    v.clamp(0, u32::MAX as i64) as u32
}

/// One `usage_stats` row per linked artifact. Read once into a map rather than
/// joined, so a target that somehow rolled up twice against the same artifact
/// cannot duplicate the artifact row.
fn usage_by_artifact(conn: &Connection) -> rusqlite::Result<HashMap<i64, UsageStat>> {
    let mut st = conn.prepare(
        "SELECT artifact_id, total, sessions, last_used, error_rate, avg_turn_tokens,
                count_30d, count_prev_30d
           FROM usage_stats WHERE artifact_id IS NOT NULL
          ORDER BY total DESC",
    )?;
    let mut out = HashMap::new();
    let rows = st.query_map([], |r| {
        Ok((
            r.get::<_, i64>(0)?,
            UsageStat {
                total: as_u32(r.get(1)?),
                sessions: as_u32(r.get(2)?),
                last_used: r.get(3)?,
                error_rate: r.get(4)?,
                avg_turn_tokens: r.get(5)?,
                count_30d: as_u32(r.get(6)?),
                count_prev_30d: as_u32(r.get(7)?),
            },
        ))
    })?;
    for row in rows {
        let (id, stat) = row?;
        out.entry(id).or_insert(stat);
    }
    Ok(out)
}

const ARTIFACT_COLUMNS: &str = "SELECT a.id, a.harness, a.layer, a.kind, a.name, a.path,
            a.plugin_name, a.description, a.bytes, f.grade, f.score, f.id, a.project_path
       FROM artifacts a LEFT JOIN files f ON f.id = a.file_id";

/// Maps one `ARTIFACT_COLUMNS` row. Rows whose `layer`/`kind` are not in the
/// model are dropped by the caller (`None`) rather than guessed at.
fn artifact_row(
    r: &Row<'_>,
    usage: &HashMap<i64, UsageStat>,
) -> rusqlite::Result<Option<ArtifactView>> {
    let id: i64 = r.get(0)?;
    let layer = Layer::parse(&r.get::<_, String>(2)?);
    let kind = ArtifactKind::parse(&r.get::<_, String>(3)?);
    let (Some(layer), Some(kind)) = (layer, kind) else {
        return Ok(None);
    };
    Ok(Some(ArtifactView {
        id: id.clamp(i32::MIN as i64, i32::MAX as i64) as i32,
        harness: r.get(1)?,
        layer,
        kind,
        name: r.get(4)?,
        path: r.get(5)?,
        plugin_name: r.get(6)?,
        description: r.get(7)?,
        bytes: as_u32(r.get(8)?),
        grade: r.get(9)?,
        score: r.get::<_, Option<i64>>(10)?.map(as_u32),
        file_id: r.get(11)?,
        usage: usage.get(&id).cloned(),
    }))
}

/// Harnesses, the global layer, and every project with its own artifacts.
pub fn setup_view(conn: &Connection) -> rusqlite::Result<SetupView> {
    let harnesses = list_harnesses(conn)?;
    let usage = usage_by_artifact(conn)?;
    let order = kind_order("a.kind");

    let mut global_stmt = conn.prepare(&format!(
        "{ARTIFACT_COLUMNS} WHERE a.project_path IS NULL ORDER BY {order}, a.name"
    ))?;
    let mut global = Vec::new();
    for row in global_stmt.query_map([], |r| artifact_row(r, &usage))? {
        global.extend(row?);
    }

    // Project artifacts in one pass, bucketed by (harness, path) — one
    // statement instead of one per project. The path alone is not a key: two
    // harnesses can have seen the same directory, and each owns only what it
    // inventoried there.
    let mut per_project: HashMap<(String, String), Vec<ArtifactView>> = HashMap::new();
    let mut proj_stmt = conn.prepare(&format!(
        "{ARTIFACT_COLUMNS} WHERE a.project_path IS NOT NULL ORDER BY {order}, a.name"
    ))?;
    for row in proj_stmt.query_map([], |r| {
        Ok((
            r.get::<_, String>(1)?,
            r.get::<_, String>(12)?,
            artifact_row(r, &usage)?,
        ))
    })? {
        let (harness, path, view) = row?;
        if let Some(view) = view {
            per_project.entry((harness, path)).or_default().push(view);
        }
    }

    let mut projects_stmt = conn.prepare(
        "SELECT harness, path, exists_on_disk, session_count, last_session_at
           FROM harness_projects
          ORDER BY last_session_at IS NULL, last_session_at DESC, path",
    )?;
    let mut projects = Vec::new();
    for row in projects_stmt.query_map([], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, i64>(2)? != 0,
            r.get::<_, i64>(3)?,
            r.get::<_, Option<String>>(4)?,
        ))
    })? {
        let (harness, path, exists, session_count, last_session_at) = row?;
        projects.push(ProjectSetup {
            name: last_component(&path),
            artifacts: per_project
                .remove(&(harness.clone(), path.clone()))
                .unwrap_or_default(),
            harness,
            path,
            exists,
            session_count: as_u32(session_count),
            last_session_at,
        });
    }

    Ok(SetupView {
        harnesses,
        global,
        projects,
    })
}

/// Every harness we know of, detected or not.
pub fn list_harnesses(conn: &Connection) -> rusqlite::Result<Vec<HarnessInfo>> {
    let mut st = conn.prepare(
        "SELECT h.id, h.display_name, h.detected, h.last_scan_at,
                (SELECT count(*) FROM harness_projects p WHERE p.harness = h.id),
                (SELECT count(*) FROM sessions s
                  WHERE s.harness = h.id AND s.parent_session_id IS NULL)
           FROM harnesses h ORDER BY h.display_name, h.id",
    )?;
    let rows = st.query_map([], |r| {
        Ok(HarnessInfo {
            id: r.get(0)?,
            display_name: r.get(1)?,
            detected: r.get::<_, i64>(2)? != 0,
            last_scan_at: scan_stamp(r.get(3)?),
            project_count: as_u32(r.get(4)?),
            session_count: as_u32(r.get(5)?),
        })
    })?;
    rows.collect()
}

/// The rule files `harness` loads inside `project_path`, in load order: the
/// global layer first, then the project's own, with `CLAUDE.md` ahead of
/// `AGENTS.md` at each layer.
///
/// Scoped to one harness — a directory can be a project of several, and each
/// merges only its own stack.
pub fn effective_rules(
    conn: &Connection,
    harness: &str,
    project_path: &str,
) -> rusqlite::Result<Vec<EffectiveRule>> {
    let mut st = conn.prepare(
        "SELECT a.layer, a.path, a.name, f.grade, f.id
           FROM artifacts a LEFT JOIN files f ON f.id = a.file_id
          WHERE a.kind = 'rule' AND a.harness = ?1
            AND (a.layer = 'global' OR (a.layer = 'project' AND a.project_path = rtrim(?2, '/')))
          ORDER BY CASE a.layer WHEN 'global' THEN 0 ELSE 1 END,
                   CASE a.name WHEN 'CLAUDE.md' THEN 0 WHEN 'AGENTS.md' THEN 1 ELSE 2 END,
                   a.name",
    )?;
    let rows = st.query_map(params![harness, project_path], |r| {
        // A layer outside the model is dropped, not defaulted — but a genuine
        // read error still propagates.
        let Some(layer) = Layer::parse(&r.get::<_, String>(0)?) else {
            return Ok(None);
        };
        Ok(Some(EffectiveRule {
            layer,
            path: r.get(1)?,
            name: r.get(2)?,
            grade: r.get(3)?,
            file_id: r.get(4)?,
        }))
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.extend(row?);
    }
    Ok(out)
}

/// Every `(kind, target)` invoked since `since`, busiest first — the ranked
/// list both the Analytics overview and a single project page render.
///
/// `scope` narrows it to one harness's work inside one project directory; the
/// overview passes `None` and ranks everything. Sessions are counted distinct
/// — a target invoked ten times in one session is one session's worth of
/// habit — and sub-agent sessions count, because the work really happened.
///
/// `limit` bounds the payload, defaulting to [`RANKED_LIMIT`]: a busy machine
/// can hold thousands of distinct targets, and nothing downstream renders
/// past the head of the list.
///
/// `artifact_id` is only reported when the whole group resolved to *one*
/// distinct non-null artifact. Two projects can each configure a skill of the
/// same name, and the overview groups across projects — picking either of them
/// would link the row to a file the number does not describe.
///
/// A scoped `project_path` is compared `rtrim`-ed: a project id read out of a
/// database written before `scan::resolve_project` stripped the git worktree
/// root's trailing separator still carries one, and only the bound parameter
/// is trimmed so `idx_invocations_project` still applies.
fn ranked_targets(
    conn: &Connection,
    since: &str,
    scope: Option<(&str, &str)>,
    limit: Option<u32>,
) -> rusqlite::Result<Vec<RankedTarget>> {
    const COLUMNS: &str = "SELECT kind, target,
                CASE WHEN count(DISTINCT artifact_id) = 1 THEN max(artifact_id) END,
                count(*), count(DISTINCT session_id), avg(is_error), avg(turn_tokens)
           FROM invocations WHERE ts >= ?1";
    const GROUPING: &str = "GROUP BY kind, target ORDER BY count(*) DESC, target";

    let limit = limit.unwrap_or(RANKED_LIMIT);
    let sql = match scope {
        Some(_) => {
            format!(
                "{COLUMNS} AND harness = ?2 AND project_path = rtrim(?3, '/') {GROUPING} LIMIT {limit}"
            )
        }
        None => format!("{COLUMNS} {GROUPING} LIMIT {limit}"),
    };
    let mut stmt = conn.prepare(&sql)?;
    let read = |r: &Row<'_>| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, Option<i64>>(2)?,
            r.get::<_, i64>(3)?,
            r.get::<_, i64>(4)?,
            r.get::<_, Option<f64>>(5)?,
            r.get::<_, Option<f64>>(6)?,
        ))
    };
    let rows = match scope {
        Some((harness, project_path)) => {
            stmt.query_map(params![since, harness, project_path], read)?
        }
        None => stmt.query_map(params![since], read)?,
    };

    let mut ranked = Vec::new();
    for row in rows {
        let (kind, target, artifact_id, uses, sessions, error_rate, avg_turn_tokens) = row?;
        // A kind outside the model is dropped rather than guessed at.
        let Some(kind) = InvocationKind::parse(&kind) else {
            continue;
        };
        ranked.push(RankedTarget {
            kind,
            target,
            artifact_id: artifact_id.map(|id| id.clamp(i32::MIN as i64, i32::MAX as i64) as i32),
            uses: as_u32(uses),
            sessions: as_u32(sessions),
            error_rate: error_rate.unwrap_or(0.0),
            avg_turn_tokens,
        });
    }
    Ok(ranked)
}

/// The `window_days` UTC calendar days ending on the day `now_epoch_secs`
/// falls in, oldest first. Days are `YYYY-MM-DD`, taken off the same RFC3339
/// rendering `sessions.started_at` is stored in.
fn window_calendar_days(now_epoch_secs: i64, window_days: u32) -> Vec<String> {
    let today_start = now_epoch_secs.div_euclid(86_400) * 86_400;
    (0..i64::from(window_days))
        .rev()
        .map(|back| {
            let stamp = iso_from_epoch(today_start - back * 86_400);
            stamp[..10].to_string()
        })
        .collect()
}

/// One project's usage over the `window_days` ending at `now_epoch_secs`: what
/// `harness` invoked inside `project_path`, and how often it was worked in.
///
/// Scoped to one harness, like [`effective_rules`] — a directory can be a
/// project of several, and each only accounts for its own sessions.
///
/// `window_days` is capped at [`MAX_WINDOW_DAYS`]: the daily series has one
/// point per day, so an unbounded window is an unbounded payload.
pub fn project_usage(
    conn: &Connection,
    harness: &str,
    project_path: &str,
    now_epoch_secs: i64,
    window_days: u32,
) -> rusqlite::Result<ProjectUsage> {
    let window_days = window_days.clamp(1, MAX_WINDOW_DAYS);
    // The ranking and the sparkline share one bound: the first calendar day of
    // the series. Bounding the ranking a few hours earlier would rank work the
    // sparkline has no bucket for.
    let days = window_calendar_days(now_epoch_secs, window_days);
    let since = format!("{}T00:00:00Z", days[0]);
    let ranked = ranked_targets(conn, &since, Some((harness, project_path)), None)?;

    // `started_at` is a fixed-width UTC RFC3339 stamp, so its first ten
    // characters are the UTC calendar day. Top-level only: a sub-agent
    // transcript is not a day's worth of work on its own.
    let mut days_stmt = conn.prepare(
        "SELECT substr(started_at, 1, 10) AS day, count(*) FROM sessions
          WHERE harness = ?1 AND project_path = rtrim(?2, '/') AND parent_session_id IS NULL
            AND started_at >= ?3
          GROUP BY day",
    )?;
    let mut counts: HashMap<String, u32> = HashMap::new();
    for row in days_stmt.query_map(params![harness, project_path, since], |r| {
        Ok((r.get::<_, String>(0)?, as_u32(r.get::<_, i64>(1)?)))
    })? {
        let (day, count) = row?;
        counts.insert(day, count);
    }

    // Zero-filled: a quiet day is a zero in the sparkline, not a point the
    // chart interpolates over.
    let sessions_per_day = days
        .into_iter()
        .map(|day| {
            let count = counts.get(&day).copied().unwrap_or(0);
            DayCount { day, count }
        })
        .collect();

    Ok(ProjectUsage {
        ranked,
        sessions_per_day,
    })
}

/// Usage aggregates for the Analytics screen, over the `window_days` ending at
/// `now_epoch_secs`.
///
/// The window bounds all four aggregates: invocations by `invocations.ts`,
/// projects by `sessions.started_at`. Nothing here is all-time, so the ranked
/// list, the kind totals and the error rates can be read against each other.
pub fn usage_overview(
    conn: &Connection,
    now_epoch_secs: i64,
    window_days: u32,
) -> rusqlite::Result<UsageOverview> {
    // `invocations.ts` and `sessions.started_at` are fixed-width UTC RFC3339
    // strings, so the window bound compares lexicographically.
    let since = iso_from_epoch(now_epoch_secs - i64::from(window_days) * 86_400);

    let ranked = ranked_targets(conn, &since, None, Some(RANKED_LIMIT))?;

    // Read the windowed totals into a map and project them onto the fixed kind
    // order: a kind with nothing in the window is a zero, not a missing bar.
    let mut kind_stmt = conn.prepare(
        "SELECT kind, count(*), avg(turn_tokens) FROM invocations
          WHERE ts >= ?1 GROUP BY kind",
    )?;
    let mut totals: HashMap<String, (i64, Option<f64>)> = HashMap::new();
    for row in kind_stmt.query_map(params![since], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, i64>(1)?,
            r.get::<_, Option<f64>>(2)?,
        ))
    })? {
        let (kind, total, avg) = row?;
        totals.insert(kind, (total, avg));
    }
    let by_kind = KIND_ORDER
        .iter()
        .map(|&kind| {
            let (total, avg) = totals.get(kind.as_str()).copied().unwrap_or((0, None));
            KindTotal {
                kind,
                total: as_u32(total),
                avg_turn_tokens: avg,
            }
        })
        .collect();

    // Counted off `sessions` rather than the `harness_projects` rollup, which
    // is all-time; top-level only, so sub-agent transcripts don't inflate it.
    let mut sessions_stmt = conn.prepare(
        "SELECT project_path, count(*) AS n FROM sessions
          WHERE parent_session_id IS NULL AND started_at >= ?1
          GROUP BY project_path ORDER BY n DESC, project_path",
    )?;
    let sessions_per_project = sessions_stmt
        .query_map(params![since], |r| {
            let path: String = r.get(0)?;
            Ok(ProjectSessions {
                name: last_component(&path),
                path,
                sessions: as_u32(r.get(1)?),
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    let mut mcp_stmt = conn.prepare(
        "SELECT target, count(*) AS n, avg(is_error) FROM invocations
          WHERE kind = 'mcp' AND ts >= ?1 GROUP BY target ORDER BY n DESC, target",
    )?;
    let mcp_error_rates = mcp_stmt
        .query_map(params![since], |r| {
            Ok(TargetRate {
                target: r.get(0)?,
                total: as_u32(r.get(1)?),
                error_rate: r.get(2)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    Ok(UsageOverview {
        window_days,
        ranked,
        by_kind,
        sessions_per_project,
        mcp_error_rates,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::harness::claude_code::test_support::fixture_home;
    use crate::harness::claude_code::{paths::ClaudeHome, ClaudeCode};
    use crate::harness::Harness;
    use crate::store::test_conn;

    /// The fixture home plus the tempdir keeping it alive. Derefs to
    /// [`ClaudeHome`] so tests read `home.root` as usual.
    struct Fixture {
        home: ClaudeHome,
        _guard: tempfile::TempDir,
    }

    impl std::ops::Deref for Fixture {
        type Target = ClaudeHome;
        fn deref(&self) -> &ClaudeHome {
            &self.home
        }
    }

    /// The days of a zero-filled series that actually saw a session.
    fn busy_days(days: &[DayCount]) -> Vec<DayCount> {
        days.iter().filter(|d| d.count > 0).cloned().collect()
    }

    /// A database in the state a real scan leaves it in: harness pass
    /// (inventory + usage + rollup) followed by the file grader over the roots
    /// and loose rule files the harness pass reported.
    fn seeded() -> (Connection, Fixture) {
        let (guard, home) = fixture_home();
        let conn = test_conn();
        let harnesses: Vec<Box<dyn Harness>> = vec![Box::new(ClaudeCode::with_home(home.clone()))];
        // 2026-08-02T00:00:00Z — one day after the fixture's session.
        let outcome = crate::harness_scan::run_harness_scan(&conn, &harnesses, 1_785_628_800)
            .expect("harness scan");
        crate::scan::run_scan_all(&conn, &outcome.roots, &outcome.extra_files, |_, _| {})
            .expect("file scan");
        (
            conn,
            Fixture {
                home,
                _guard: guard,
            },
        )
    }

    #[test]
    fn setup_view_joins_grades_and_usage() {
        let (conn, home) = seeded();
        let v = setup_view(&conn).unwrap();
        assert_eq!(v.harnesses.len(), 1);
        assert_eq!(v.harnesses[0].project_count, 2);
        let adapt = v.global.iter().find(|a| a.name == "adapt").unwrap();
        assert_eq!(adapt.usage.as_ref().map(|u| u.total), Some(1));
        let unused = v.global.iter().find(|a| a.name == "unused-skill").unwrap();
        assert!(unused.usage.is_none());
        let rule = v
            .global
            .iter()
            .find(|a| a.kind == ArtifactKind::Rule)
            .unwrap();
        assert!(rule.grade.is_some() && rule.file_id.is_some());
        assert_eq!(
            v.projects[0].path,
            home.root.join("work/app").to_string_lossy()
        );
        assert_eq!(v.projects[0].name, "app");
        assert!(v.projects[0].exists);
        assert!(!v.projects[1].exists);
    }

    #[test]
    fn effective_rules_orders_global_before_project() {
        let (conn, home) = seeded();
        let r = effective_rules(
            &conn,
            "claude_code",
            &home.root.join("work/app").to_string_lossy(),
        )
        .unwrap();
        assert_eq!(
            r.iter()
                .map(|x| (x.layer, x.name.as_str()))
                .collect::<Vec<_>>(),
            vec![(Layer::Global, "CLAUDE.md"), (Layer::Project, "CLAUDE.md")]
        );
    }

    /// Two harnesses can both know a path; each loads only its own rule stack.
    #[test]
    fn effective_rules_are_scoped_to_one_harness() {
        let (conn, home) = seeded();
        let app = home.root.join("work/app").to_string_lossy().into_owned();
        assert!(effective_rules(&conn, "other", &app).unwrap().is_empty());
        assert!(!effective_rules(&conn, "claude_code", &app)
            .unwrap()
            .is_empty());
    }

    /// A project path is only unique within a harness: a second harness that
    /// has seen the same directory must not inherit the first one's artifacts.
    #[test]
    fn setup_view_buckets_project_artifacts_per_harness() {
        let (conn, home) = seeded();
        let app = home.root.join("work/app").to_string_lossy().into_owned();
        conn.execute(
            "INSERT INTO harnesses(id, display_name, detected) VALUES('other', 'Other', 1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO harness_projects(harness, path, exists_on_disk)
             VALUES('other', ?1, 1)",
            [&app],
        )
        .unwrap();

        let v = setup_view(&conn).unwrap();
        let rows: Vec<_> = v.projects.iter().filter(|p| p.path == app).collect();
        assert_eq!(rows.len(), 2);
        let claude = rows.iter().find(|p| p.harness == "claude_code").unwrap();
        let other = rows.iter().find(|p| p.harness == "other").unwrap();
        assert!(!claude.artifacts.is_empty());
        assert!(
            other.artifacts.is_empty(),
            "a harness that inventoried nothing there owns nothing there"
        );
    }

    #[test]
    fn usage_overview_windows_every_aggregate() {
        let (conn, _home) = seeded();
        let u = usage_overview(&conn, 1_785_628_800, 90).unwrap();
        assert_eq!(u.window_days, 90);
        assert_eq!(
            u.by_kind
                .iter()
                .map(|k| (k.kind, k.total))
                .collect::<Vec<_>>(),
            vec![
                (InvocationKind::Skill, 2),
                (InvocationKind::Agent, 1),
                (InvocationKind::Mcp, 1),
                (InvocationKind::Builtin, 2),
            ]
        );
        let pw = u
            .mcp_error_rates
            .iter()
            .find(|t| t.target == "playwright")
            .unwrap();
        assert!((pw.error_rate - 1.0).abs() < f64::EPSILON);
        assert_eq!(u.sessions_per_project.len(), 1);
        assert_eq!(u.sessions_per_project[0].name, "app");
        assert_eq!(u.sessions_per_project[0].sessions, 1);
    }

    #[test]
    fn usage_overview_ranks_every_target_in_the_window() {
        let (conn, _home) = seeded();
        let u = usage_overview(&conn, 1_785_628_800, 90).unwrap();
        // Every fixture target is invoked exactly once, so the whole list is
        // the tie-break: target ascending, in SQLite's binary collation.
        assert_eq!(
            u.ranked
                .iter()
                .map(|r| r.target.as_str())
                .collect::<Vec<_>>(),
            vec![
                "Bash",
                "Read",
                "adapt",
                "playwright",
                "reviewer",
                "superpowers:brainstorming",
            ]
        );

        let pw = u.ranked.iter().find(|r| r.target == "playwright").unwrap();
        assert_eq!(pw.kind, InvocationKind::Mcp);
        assert_eq!((pw.uses, pw.sessions), (1, 1));
        assert!((pw.error_rate - 1.0).abs() < f64::EPSILON);

        let adapt = u.ranked.iter().find(|r| r.target == "adapt").unwrap();
        assert_eq!(adapt.kind, InvocationKind::Skill);
        assert_eq!(adapt.error_rate, 0.0);
        assert!(
            adapt.artifact_id.is_some(),
            "a skill that resolved to a file carries the artifact it resolved to"
        );
        assert!(adapt.avg_turn_tokens.is_some());

        let bash = u.ranked.iter().find(|r| r.target == "Bash").unwrap();
        assert_eq!(bash.kind, InvocationKind::Builtin);
        assert_eq!(bash.artifact_id, None, "a builtin resolves to no artifact");
    }

    #[test]
    fn project_usage_ranks_only_that_projects_targets() {
        let (conn, home) = seeded();
        let app = home.root.join("work/app").to_string_lossy().into_owned();
        let u = project_usage(&conn, "claude_code", &app, 1_785_628_800, 90).unwrap();
        assert_eq!(
            u.ranked
                .iter()
                .map(|r| r.target.as_str())
                .collect::<Vec<_>>(),
            vec![
                "Bash",
                "Read",
                "adapt",
                "playwright",
                "reviewer",
                "superpowers:brainstorming",
            ],
            "sub-agent invocations belong to the project their session ran in"
        );
        assert_eq!(
            busy_days(&u.sessions_per_day),
            vec![DayCount {
                day: "2026-08-01".into(),
                count: 1,
            }],
            "top-level sessions only, one bucket per calendar day"
        );
    }

    /// The daily series is the sparkline's x-axis: it must be the whole
    /// window, so a quiet day is a gap in the line rather than a missing point
    /// the chart closes over.
    #[test]
    fn project_usage_zero_fills_every_day_in_the_window() {
        let (conn, home) = seeded();
        let app = home.root.join("work/app").to_string_lossy().into_owned();
        let u = project_usage(&conn, "claude_code", &app, 1_785_628_800, 7).unwrap();

        assert_eq!(
            u.sessions_per_day.len(),
            7,
            "one point per day in the window"
        );
        assert!(
            u.sessions_per_day.windows(2).all(|w| w[0].day < w[1].day),
            "oldest day first"
        );
        assert_eq!(
            u.sessions_per_day.last().unwrap().day,
            "2026-08-02",
            "the series ends on the day the clock is in"
        );
        assert_eq!(
            busy_days(&u.sessions_per_day),
            vec![DayCount {
                day: "2026-08-01".into(),
                count: 1,
            }]
        );
    }

    /// A caller asking for a decade of days would be handed a decade of
    /// points; the series is capped at a year's worth.
    #[test]
    fn project_usage_caps_the_daily_series_at_a_year() {
        let (conn, home) = seeded();
        let app = home.root.join("work/app").to_string_lossy().into_owned();
        let u = project_usage(&conn, "claude_code", &app, 1_785_628_800, 10_000).unwrap();
        assert_eq!(u.sessions_per_day.len(), 366);
    }

    /// The project filter is a filter: a path the harness never ran in has no
    /// usage of its own, even though the database is full of invocations.
    #[test]
    fn project_usage_of_an_unused_project_is_empty() {
        let (conn, home) = seeded();
        let gone = home.root.join("work/gone").to_string_lossy().into_owned();
        let u = project_usage(&conn, "claude_code", &gone, 1_785_628_800, 90).unwrap();
        assert!(u.ranked.is_empty());
        assert_eq!(u.sessions_per_day.len(), 90);
        assert!(u.sessions_per_day.iter().all(|d| d.count == 0));
    }

    /// Same window rule as the overview: a clock past the fixture empties the
    /// ranking and flatlines the sparkline rather than falling back to
    /// all-time.
    #[test]
    fn project_usage_is_windowed() {
        let (conn, home) = seeded();
        let app = home.root.join("work/app").to_string_lossy().into_owned();
        let u = project_usage(&conn, "claude_code", &app, 1_789_430_400, 1).unwrap();
        assert!(u.ranked.is_empty());
        assert!(busy_days(&u.sessions_per_day).is_empty());
    }

    /// A project id read out of a database written before the trailing-slash
    /// fix still carries one. Every project-scoped read must land on the same
    /// rows the slash-free id does, rather than quietly returning an empty
    /// project page.
    #[test]
    fn project_scoped_reads_accept_a_trailing_slash() {
        let (conn, home) = seeded();
        let app = home.root.join("work/app").to_string_lossy().into_owned();
        let slashed = format!("{app}/");

        let u = project_usage(&conn, "claude_code", &slashed, 1_785_628_800, 90).unwrap();
        assert!(
            !u.ranked.is_empty(),
            "the ranking must not be filtered away"
        );
        assert_eq!(
            busy_days(&u.sessions_per_day),
            vec![DayCount {
                day: "2026-08-01".into(),
                count: 1,
            }]
        );
        assert!(
            !effective_rules(&conn, "claude_code", &slashed)
                .unwrap()
                .is_empty(),
            "the project's rule stack must still resolve"
        );
    }

    /// Two projects can each configure a skill of the same name. The overview
    /// groups by `(kind, target)` across every project, so it must not claim
    /// the pair resolved to one artifact — inside a single project it does.
    #[test]
    fn an_ambiguous_target_resolves_to_no_artifact_in_the_overview() {
        let (conn, home) = seeded();
        let other = home.root.join("work/other").to_string_lossy().into_owned();
        conn.execute(
            "INSERT INTO artifacts(harness, layer, project_path, kind, name, path, bytes, hash, seen_at)
             VALUES('claude_code', 'project', ?1, 'skill', 'adapt', ?2, 10, 'h2', '2026-08-01T00:00:00Z')",
            params![other, format!("{other}/.claude/skills/adapt/SKILL.md")],
        )
        .unwrap();
        let other_artifact = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO invocations(harness, session_id, tool_use_id, project_path, ts,
                                     tool_name, kind, target, artifact_id)
             VALUES('claude_code', 'other-session', 'tu-1', ?1, '2026-08-01T12:00:01Z',
                    'Skill', 'skill', 'adapt', ?2)",
            params![other, other_artifact],
        )
        .unwrap();

        let overview = usage_overview(&conn, 1_785_628_800, 90).unwrap();
        let adapt = overview
            .ranked
            .iter()
            .find(|r| r.target == "adapt")
            .unwrap();
        assert_eq!(
            adapt.artifact_id, None,
            "two artifacts answer to this name — the overview must not pick one"
        );

        let scoped = project_usage(&conn, "claude_code", &other, 1_785_628_800, 90).unwrap();
        let adapt = scoped.ranked.iter().find(|r| r.target == "adapt").unwrap();
        assert_eq!(adapt.artifact_id, Some(other_artifact as i32));
    }

    /// The window bounds every aggregate, not just the ranking: a clock past
    /// the fixture's only session empties all four of them.
    #[test]
    fn usage_overview_outside_the_window_is_empty_but_still_shaped() {
        let (conn, _home) = seeded();
        // 2026-09-15T00:00:00Z, one day back — six weeks past the fixture.
        let u = usage_overview(&conn, 1_789_430_400, 1).unwrap();
        assert_eq!(u.window_days, 1);
        assert!(u.ranked.is_empty());
        assert!(u.sessions_per_project.is_empty());
        assert!(u.mcp_error_rates.is_empty());
        // `by_kind` keeps its fixed legend order — an empty window reads as
        // four zeroes, not as four missing kinds.
        assert_eq!(
            u.by_kind,
            KIND_ORDER
                .iter()
                .map(|&kind| KindTotal {
                    kind,
                    total: 0,
                    avg_turn_tokens: None,
                })
                .collect::<Vec<_>>()
        );
    }
}
