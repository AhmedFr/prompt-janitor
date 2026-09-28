//! Reveal or open things the scan found that have no artifact row: a graded
//! file from an extra scan folder, and a project folder. Each takes an id the
//! database already holds — never a path from the webview — so granting these
//! commands does not grant "open anything on disk".

use rusqlite::{Connection, OptionalExtension};

/// The graded file's path, if `file_id` is one the grader recorded and its
/// file is still there — the same on-disk check `open_artifact` runs, so a
/// row the scan has not yet caught up with can't be handed to LaunchServices.
pub fn graded_file_path(conn: &Connection, file_id: &str) -> Result<String, String> {
    let path = conn
        .query_row("SELECT path FROM files WHERE id = ?1", [file_id], |r| {
            r.get::<_, String>(0)
        })
        .optional()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "That file is no longer in the scan.".to_string())?;
    if !std::path::Path::new(&path).is_file() {
        return Err("That file is no longer on disk.".to_string());
    }
    Ok(path)
}

/// The project folder, if some harness or the grader knows it as a project.
pub fn project_folder(conn: &Connection, project_path: &str) -> Result<String, String> {
    let wanted = project_path.trim_end_matches('/');
    conn.query_row(
        "SELECT rtrim(path, '/') FROM harness_projects WHERE rtrim(path, '/') = ?1
         UNION SELECT rtrim(root_path, '/') FROM projects WHERE rtrim(root_path, '/') = ?1 LIMIT 1",
        [wanted],
        |r| r.get::<_, String>(0),
    )
    .optional()
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "That folder is not a scanned project.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::test_conn;

    fn graded(conn: &rusqlite::Connection, id: &str) {
        conn.execute(
            "INSERT INTO projects(id, name, root_path) VALUES('/code/app', 'app', '/code/app')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files(id, project_id, path, kind) VALUES(?1, '/code/app', ?1, 'AGENTS.md')",
            [id],
        )
        .unwrap();
    }

    #[test]
    fn a_graded_file_resolves_to_its_own_path() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("AGENTS.md");
        std::fs::write(&path, "# rules\n").unwrap();
        let conn = test_conn();
        graded(&conn, path.to_str().unwrap());
        assert_eq!(
            graded_file_path(&conn, path.to_str().unwrap()).unwrap(),
            path.to_str().unwrap()
        );
    }

    #[test]
    fn an_unknown_file_id_is_refused() {
        let conn = test_conn();
        assert!(graded_file_path(&conn, "/etc/passwd").is_err());
    }

    #[test]
    fn a_row_whose_file_left_the_disk_is_refused() {
        let conn = test_conn();
        graded(&conn, "/code/app/AGENTS.md");
        let err = graded_file_path(&conn, "/code/app/AGENTS.md").expect_err("file is gone");
        assert!(err.contains("no longer on disk"), "got: {err}");
    }

    #[test]
    fn a_known_project_folder_resolves_from_either_table() {
        let conn = test_conn();
        graded(&conn, "/code/app/AGENTS.md");
        assert_eq!(project_folder(&conn, "/code/app/").unwrap(), "/code/app");
        conn.execute("INSERT INTO harness_projects(harness, path, exists_on_disk) VALUES('claude_code', '/code/web', 1)", []).unwrap();
        assert_eq!(project_folder(&conn, "/code/web").unwrap(), "/code/web");
    }

    #[test]
    fn an_unknown_folder_is_refused() {
        let conn = test_conn();
        assert!(project_folder(&conn, "/Users").is_err());
    }
}
