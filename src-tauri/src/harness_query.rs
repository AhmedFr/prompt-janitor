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

/// One day's invocations of a target.
#[derive(Debug, Clone, PartialEq, serde::Serialize, specta::Type)]
pub struct UsagePoint {
    /// `YYYY-MM-DD`.
    pub day: String,
    pub count: u32,
    pub errors: u32,
}

/// A target's daily usage over the reporting window.
#[derive(Debug, Clone, PartialEq, serde::Serialize, specta::Type)]
pub struct UsageSeries {
    pub kind: InvocationKind,
    pub target: String,
    pub points: Vec<UsagePoint>,
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

/// What the Analytics usage tab renders.
#[derive(Debug, Clone, PartialEq, serde::Serialize, specta::Type)]
pub struct UsageOverview {
    /// Top 8 targets by volume over the last 90 days, bucketed by day.
    pub top: Vec<UsageSeries>,
    /// All-time totals per invocation kind, in `skill, agent, mcp, builtin`
    /// order.
    pub by_kind: Vec<KindTotal>,
    /// Top-level sessions per project.
    pub sessions_per_project: Vec<ProjectSessions>,
    /// All-time error rate per MCP server, busiest first.
    pub mcp_error_rates: Vec<TargetRate>,
}

/// How many days of daily buckets `usage_overview` reports.
const WINDOW_DAYS: i64 = 90;
/// How many series the top chart can legibly hold.
const TOP_SERIES: usize = 8;

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
            AND (a.layer = 'global' OR (a.layer = 'project' AND a.project_path = ?2))
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

/// Usage aggregates for the Analytics screen. `now_epoch_secs` anchors the
/// 90-day window the `top` series is bucketed over; the other aggregates are
/// all-time.
pub fn usage_overview(conn: &Connection, now_epoch_secs: i64) -> rusqlite::Result<UsageOverview> {
    // `invocations.ts` is a fixed-width UTC RFC3339 string, so the window bound
    // compares lexicographically.
    let since = iso_from_epoch(now_epoch_secs - WINDOW_DAYS * 86_400);

    // One (kind, target) per group of adjacent rows — the query orders by
    // kind, target, day, so a series' buckets arrive together and in order.
    let mut series: Vec<(UsageSeries, u32)> = Vec::new();
    let mut st = conn.prepare(
        "SELECT kind, target, substr(ts, 1, 10) AS day, count(*), sum(is_error)
           FROM invocations WHERE ts >= ?1
          GROUP BY kind, target, day ORDER BY kind, target, day",
    )?;
    let rows = st.query_map(params![since], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, String>(2)?,
            r.get::<_, i64>(3)?,
            r.get::<_, i64>(4)?,
        ))
    })?;
    for row in rows {
        let (kind, target, day, count, errors) = row?;
        let Some(kind) = InvocationKind::parse(&kind) else {
            continue;
        };
        let count = as_u32(count);
        let fresh = !matches!(series.last(), Some((s, _)) if s.kind == kind && s.target == target);
        if fresh {
            series.push((
                UsageSeries {
                    kind,
                    target,
                    points: Vec::new(),
                },
                0,
            ));
        }
        let Some((s, total)) = series.last_mut() else {
            continue;
        };
        s.points.push(UsagePoint {
            day,
            count,
            errors: as_u32(errors),
        });
        *total += count;
    }
    // Busiest first; ties broken by target so the chart is stable run to run.
    series.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.target.cmp(&b.0.target)));
    let top = series
        .into_iter()
        .take(TOP_SERIES)
        .map(|(s, _)| s)
        .collect();

    let mut kind_stmt = conn.prepare(&format!(
        "SELECT kind, count(*), avg(turn_tokens) FROM invocations
          GROUP BY kind ORDER BY {}",
        kind_case()
    ))?;
    let mut by_kind = Vec::new();
    for row in kind_stmt.query_map([], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, i64>(1)?,
            r.get::<_, Option<f64>>(2)?,
        ))
    })? {
        let (kind, total, avg) = row?;
        if let Some(kind) = InvocationKind::parse(&kind) {
            by_kind.push(KindTotal {
                kind,
                total: as_u32(total),
                avg_turn_tokens: avg,
            });
        }
    }

    // `harness_projects.session_count` already excludes sub-agent transcripts.
    let mut sessions_stmt = conn.prepare(
        "SELECT path, sum(session_count) AS n FROM harness_projects
          GROUP BY path ORDER BY n DESC, path",
    )?;
    let sessions_per_project = sessions_stmt
        .query_map([], |r| {
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
          WHERE kind = 'mcp' GROUP BY target ORDER BY n DESC, target",
    )?;
    let mcp_error_rates = mcp_stmt
        .query_map([], |r| {
            Ok(TargetRate {
                target: r.get(0)?,
                total: as_u32(r.get(1)?),
                error_rate: r.get(2)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    Ok(UsageOverview {
        top,
        by_kind,
        sessions_per_project,
        mcp_error_rates,
    })
}

/// `skill, agent, mcp, builtin` — the order the UI legend lists kinds in.
fn kind_case() -> String {
    let order = [
        InvocationKind::Skill,
        InvocationKind::Agent,
        InvocationKind::Mcp,
        InvocationKind::Builtin,
    ];
    let mut sql = String::from("CASE kind ");
    for (i, k) in order.iter().enumerate() {
        sql.push_str(&format!("WHEN '{}' THEN {i} ", k.as_str()));
    }
    sql.push_str("ELSE 99 END");
    sql
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
    fn usage_overview_buckets_by_day() {
        let (conn, _home) = seeded();
        let u = usage_overview(&conn, 1_785_628_800).unwrap();
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
        let top = u.top.iter().find(|s| s.target == "adapt").unwrap();
        assert_eq!(
            top.points,
            vec![UsagePoint {
                day: "2026-08-01".into(),
                count: 1,
                errors: 0
            }]
        );
        assert_eq!(u.sessions_per_project[0].sessions, 1);
    }
}
