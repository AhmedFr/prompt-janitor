//! Replacing the hand-added scan folders, and dropping what a removed folder
//! alone brought in.
//!
//! Without the drop, removing a folder in Settings left its projects in the
//! sidebar and the Projects table until the follow-up scan finished — and that
//! scan is refused outright when another is already running.

use std::path::Path;

use rusqlite::{params, Connection};

/// Persist `folders` as the extra scan folders, then delete every project that
/// sat inside a folder no longer listed and that nothing else still scans.
/// Returns how many projects were dropped.
///
/// "Nothing else" is every remaining extra folder and every harness project on
/// disk, related in either direction: a harness session in `mono/apps/web`
/// resolves to the repo root `mono`, so `mono` stays. Being conservative here
/// is cheap — anything kept by mistake goes at the next scan, which rebuilds
/// the table from scratch anyway.
pub fn replace_extra_folders(conn: &Connection, folders: &[String]) -> rusqlite::Result<u32> {
    let removed: Vec<String> = crate::query::extra_scan_folders(conn)
        .into_iter()
        .filter(|old| !folders.contains(old))
        .collect();

    let json = serde_json::to_string(folders).unwrap_or_else(|_| "[]".into());
    crate::query::set_setting(conn, "extra_scan_folders", &json)?;
    if removed.is_empty() {
        return Ok(0);
    }

    let mut covering: Vec<String> = harness_paths(conn)?;
    covering.extend(folders.iter().cloned());

    let mut dropped = 0;
    for root in project_roots(conn)? {
        let orphaned = removed.iter().any(|folder| inside(&root, folder))
            && !covering
                .iter()
                .any(|c| inside(&root, c) || inside(c, &root));
        if orphaned {
            // Files cascade to their issues; grade history is kept, as a scan keeps it.
            conn.execute("DELETE FROM files WHERE project_id = ?1", params![root])?;
            conn.execute("DELETE FROM projects WHERE id = ?1", params![root])?;
            dropped += 1;
        }
    }
    Ok(dropped)
}

/// Whether `path` is `dir` or below it, component-wise (`/sidecar` is not in `/side`).
fn inside(path: &str, dir: &str) -> bool {
    Path::new(path).starts_with(Path::new(dir))
}

fn project_roots(conn: &Connection) -> rusqlite::Result<Vec<String>> {
    let mut stmt = conn.prepare("SELECT id FROM projects")?;
    let rows = stmt.query_map([], |r| r.get(0))?;
    rows.collect()
}

fn harness_paths(conn: &Connection) -> rusqlite::Result<Vec<String>> {
    let mut stmt = conn.prepare("SELECT path FROM harness_projects WHERE exists_on_disk = 1")?;
    let rows = stmt.query_map([], |r| r.get(0))?;
    rows.collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        conn
    }

    /// A project at `root` holding one prompt file, as a scan leaves it.
    fn project(conn: &Connection, root: &str) {
        conn.execute(
            "INSERT INTO projects(id, name, root_path) VALUES(?1, ?1, ?1)",
            params![root],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files(id, project_id, path, kind) VALUES(?1, ?2, ?1, 'md')",
            params![format!("{root}/CLAUDE.md"), root],
        )
        .unwrap();
    }

    fn harness_project(conn: &Connection, path: &str) {
        conn.execute(
            "INSERT INTO harness_projects(harness, path, exists_on_disk) VALUES('claude_code', ?1, 1)",
            params![path],
        )
        .unwrap();
    }

    fn roots(conn: &Connection) -> Vec<String> {
        let mut stmt = conn.prepare("SELECT id FROM projects ORDER BY id").unwrap();
        stmt.query_map([], |r| r.get(0))
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap()
    }

    fn set(conn: &Connection, folders: &[&str]) -> u32 {
        let folders: Vec<String> = folders.iter().map(|f| f.to_string()).collect();
        replace_extra_folders(conn, &folders).unwrap()
    }

    #[test]
    fn persists_the_new_list() {
        let conn = conn();
        set(&conn, &["/work", "/side"]);
        assert_eq!(
            crate::query::extra_scan_folders(&conn),
            vec!["/work", "/side"]
        );
    }

    #[test]
    fn removing_a_folder_drops_the_projects_only_it_covered() {
        let conn = conn();
        set(&conn, &["/work", "/side"]);
        project(&conn, "/work/api");
        project(&conn, "/side/blog");

        assert_eq!(set(&conn, &["/work"]), 1);
        assert_eq!(roots(&conn), vec!["/work/api"]);
        let orphans: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM files WHERE project_id = '/side/blog'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(orphans, 0, "the removed project's files go with it");
    }

    #[test]
    fn keeps_a_project_a_harness_still_works_in() {
        let conn = conn();
        set(&conn, &["/side"]);
        project(&conn, "/side/blog");
        harness_project(&conn, "/side/blog");

        assert_eq!(set(&conn, &[]), 0);
        assert_eq!(roots(&conn), vec!["/side/blog"]);
    }

    #[test]
    fn keeps_a_repo_root_a_harness_works_somewhere_inside() {
        // A harness session in `/side/mono/apps/web` resolves to the repo
        // root `/side/mono`, so that project is still scanned.
        let conn = conn();
        set(&conn, &["/side"]);
        project(&conn, "/side/mono");
        harness_project(&conn, "/side/mono/apps/web");

        assert_eq!(set(&conn, &[]), 0);
        assert_eq!(roots(&conn), vec!["/side/mono"]);
    }

    #[test]
    fn keeps_a_project_under_a_folder_that_remains() {
        let conn = conn();
        set(&conn, &["/side", "/side/blog"]);
        project(&conn, "/side/blog");

        assert_eq!(set(&conn, &["/side/blog"]), 0);
        assert_eq!(roots(&conn), vec!["/side/blog"]);
    }

    #[test]
    fn a_sibling_with_a_shared_prefix_is_not_inside() {
        let conn = conn();
        set(&conn, &["/side", "/sidecar"]);
        project(&conn, "/sidecar/app");

        assert_eq!(set(&conn, &["/sidecar"]), 0);
        assert_eq!(roots(&conn), vec!["/sidecar/app"]);
    }

    #[test]
    fn adding_a_folder_drops_nothing() {
        let conn = conn();
        project(&conn, "/work/api");
        assert_eq!(set(&conn, &["/side"]), 0);
        assert_eq!(roots(&conn), vec!["/work/api"]);
    }
}
