//! One harness-driven scan: detect → projects → inventory → usage → rollup.
//! Returns the project roots + loose rule files the file grader should scan.

use std::path::PathBuf;

use rusqlite::Connection;

use crate::harness::{Harness, Scope};
use crate::harness_store as hs;

#[derive(Debug, Default)]
pub struct HarnessScanOutcome {
    pub roots: Vec<PathBuf>,
    pub extra_files: Vec<PathBuf>,
    pub skipped_lines: u64,
    pub failed_files: u64,
    pub harness_count: u32,
    pub project_count: u32,
}

/// Run one full harness pass: for every registered harness, record whether it
/// is detected and — when it is — refresh its projects, its artifact
/// inventory (global + per existing project), and its usage index, then
/// rebuild the usage rollup.
///
/// The outcome carries what the *file* grader still has to do: the project
/// roots to walk and the loose rule files (the global `CLAUDE.md`) to read.
pub fn run_harness_scan(
    conn: &Connection,
    harnesses: &[Box<dyn Harness>],
    now_epoch_secs: i64,
) -> rusqlite::Result<HarnessScanOutcome> {
    let now = now_epoch_secs.to_string();
    let mut out = HarnessScanOutcome::default();
    for h in harnesses {
        // `detect()` hits the filesystem — ask once.
        let detected = h.detect();
        hs::upsert_harness(conn, h.id(), h.display_name(), detected, &now)?;
        if !detected {
            continue;
        }
        out.harness_count += 1;

        let projects = h.projects();
        hs::upsert_projects(conn, &projects)?;
        out.project_count += projects.len() as u32;

        let global = h.inventory(&Scope::Global);
        out.extra_files.extend(
            global
                .iter()
                .filter(|a| a.kind == crate::harness::model::ArtifactKind::Rule)
                .map(|a| PathBuf::from(&a.path)),
        );
        hs::replace_artifacts(conn, h.id(), &Scope::Global, &global, &now)?;

        // A project recorded in the harness's history may no longer exist on
        // disk; inventory and grading both skip it, but the row stays so its
        // usage history keeps resolving.
        for p in projects.iter().filter(|p| p.exists) {
            let scope = Scope::Project(p.path.clone());
            hs::replace_artifacts(conn, h.id(), &scope, &h.inventory(&scope), &now)?;
            out.roots.push(PathBuf::from(&p.path));
        }

        let mut cursor = hs::load_cursor(conn, h.id())?;
        let batch = h.index_usage(&mut cursor);
        out.skipped_lines += batch.skipped_lines;
        out.failed_files += batch.failed_files;
        hs::store_usage(conn, &batch, &cursor)?;
        hs::link_invocations_to_artifacts(conn, h.id())?;
        hs::rebuild_usage_stats(conn, h.id(), now_epoch_secs)?;
    }
    out.roots.sort();
    out.roots.dedup();
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::harness::claude_code::test_support::fixture_home;
    use crate::harness::claude_code::ClaudeCode;
    use rusqlite::Connection;

    #[test]
    fn orchestrates_inventory_usage_and_reports_roots() {
        let (_g, home) = fixture_home();
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        let hs: Vec<Box<dyn crate::harness::Harness>> =
            vec![Box::new(ClaudeCode::with_home(home.clone()))];
        let out = run_harness_scan(&conn, &hs, 1_785_628_800).unwrap();
        assert_eq!(out.harness_count, 1);
        assert_eq!(out.project_count, 2);
        assert_eq!(out.roots, vec![home.root.join("work/app")]); // missing project excluded
        assert_eq!(out.extra_files, vec![home.global_rule()]);
        assert_eq!(out.skipped_lines, 1);
        // Six rollup rows — one per (kind, target) in the fixture's two
        // transcripts; matches `harness_store`'s own assertion on the same
        // fixture.
        let n: i64 = conn
            .query_row("SELECT count(*) FROM usage_stats", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 6);
        let det: i64 = conn
            .query_row(
                "SELECT detected FROM harnesses WHERE id='claude_code'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(det, 1);
    }
}
