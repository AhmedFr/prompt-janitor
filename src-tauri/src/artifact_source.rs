//! Reading and writing one artifact's file on disk.
//!
//! Skills are not in the `files` table — only graded rule files are — so
//! `get_file_detail` cannot reach them and this module exists to fill that
//! gap for the Setup screen's skill panel.
//!
//! Both entry points take an **artifact id**, never a path. The path is read
//! back out of the `artifacts` row the id names, so the set of files the
//! webview can address is exactly the set the scanner already found. A
//! compromised or buggy frontend cannot ask this module for `/etc/passwd`,
//! because there is no parameter in which to say it.

use rusqlite::Connection;

/// One artifact's file, as the panel reads it.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct ArtifactSource {
    /// Absolute path on disk, shown in the panel header.
    pub path: String,
    pub content: String,
    /// Size of `content` in bytes — what the Size column shows.
    pub bytes: i32,
}

/// What a successful save reports back, so the table can update without a rescan.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct ArtifactSaved {
    pub bytes: i32,
}

/// The largest file this module will read or write, in bytes.
///
/// A skill is prose; the biggest one in a real install is a few tens of KB.
/// The cap is here so a mis-scanned binary cannot be pulled into the webview
/// as a string, and so a runaway editor cannot write an unbounded file — not
/// because anyone expects to hit it.
pub const MAX_BYTES: usize = 1024 * 1024;

/// The artifact kinds this module will open.
///
/// Only skills for now. Agents and commands are the same shape and would slot
/// in here unchanged, but each one added is a new file the app can overwrite,
/// so the list grows when a screen actually needs it and not before.
const EDITABLE_KINDS: &[&str] = &["skill"];

/// Resolves an artifact id to a path this module is willing to touch.
///
/// The kind check is the security boundary, not a convenience: it is what
/// stops an id that happens to name a `settings.json` — or any other artifact
/// row — from being read into the panel or written through it.
fn editable_path(conn: &Connection, artifact_id: i32) -> Result<String, String> {
    let row: Option<(String, String)> = conn
        .query_row(
            "SELECT kind, path FROM artifacts WHERE id = ?1",
            [artifact_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map(Some)
        .or_else(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => Ok(None),
            other => Err(other.to_string()),
        })?;

    let (kind, path) =
        row.ok_or_else(|| "That artifact is no longer in the inventory.".to_string())?;
    if !EDITABLE_KINDS.contains(&kind.as_str()) {
        return Err(format!("A {kind} can't be edited here."));
    }
    Ok(path)
}

/// Reads an artifact's file for the panel.
pub fn read_source(conn: &Connection, artifact_id: i32) -> Result<ArtifactSource, String> {
    let path = editable_path(conn, artifact_id)?;

    let meta = std::fs::metadata(&path).map_err(|e| format!("Couldn't open the file: {e}"))?;
    if !meta.is_file() {
        return Err("That path is not a file.".to_string());
    }
    if meta.len() as usize > MAX_BYTES {
        return Err("That file is too large to open here.".to_string());
    }

    // `read_to_string` rather than a lossy decode: a skill that is not UTF-8
    // is a skill Claude Code cannot read either, and silently rendering
    // replacement characters would invite the user to save that damage back.
    let content =
        std::fs::read_to_string(&path).map_err(|e| format!("Couldn't read the file: {e}"))?;
    let bytes = content.len() as i32;
    Ok(ArtifactSource {
        path,
        content,
        bytes,
    })
}

/// Writes the panel's edits back to the artifact's file.
///
/// `artifacts.bytes` is updated so the Size column is right immediately, but
/// `hash` is deliberately left stale: it is how the scanner detects a changed
/// file, and refreshing it here would tell the next scan that nothing had
/// happened and leave the skill's grade and description describing the old
/// text.
pub fn write_source(
    conn: &Connection,
    artifact_id: i32,
    content: &str,
) -> Result<ArtifactSaved, String> {
    let path = editable_path(conn, artifact_id)?;
    if content.len() > MAX_BYTES {
        return Err("That's too large to save.".to_string());
    }
    // Refuse to create a file that the scan found and something has since
    // removed: the user thinks they are editing a skill that exists, and
    // writing it back would resurrect it somewhere the harness may no longer
    // look.
    if !std::path::Path::new(&path).is_file() {
        return Err("That file is no longer on disk.".to_string());
    }

    std::fs::write(&path, content).map_err(|e| format!("Couldn't save the file: {e}"))?;

    let bytes = content.len() as i32;
    conn.execute(
        "UPDATE artifacts SET bytes = ?1 WHERE id = ?2",
        rusqlite::params![bytes, artifact_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(ArtifactSaved { bytes })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::test_conn;

    /// Inserts an artifact row of `kind` pointing at `path`, returning its id.
    fn insert_artifact(conn: &Connection, kind: &str, path: &str) -> i32 {
        conn.execute(
            "INSERT INTO artifacts(harness, layer, project_path, kind, name, path, bytes, hash, seen_at)
             VALUES('claude_code', 'global', NULL, ?1, 'a-skill', ?2, 0, 'stale-hash', '2026-09-10T00:00:00Z')",
            rusqlite::params![kind, path],
        )
        .unwrap();
        conn.last_insert_rowid() as i32
    }

    #[test]
    fn reads_a_skills_content_and_byte_count() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("SKILL.md");
        std::fs::write(&path, "# Title\n").unwrap();
        let conn = test_conn();
        let id = insert_artifact(&conn, "skill", path.to_str().unwrap());

        let source = read_source(&conn, id).unwrap();

        assert_eq!(source.content, "# Title\n");
        assert_eq!(source.bytes, 8);
        assert_eq!(source.path, path.to_str().unwrap());
    }

    #[test]
    fn reading_an_unknown_artifact_id_is_an_error() {
        let conn = test_conn();
        let err = read_source(&conn, 9999).expect_err("no such artifact");
        assert!(err.contains("no longer in the inventory"), "got: {err}");
    }

    #[test]
    fn reading_a_non_skill_artifact_is_refused() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        std::fs::write(&path, "{}").unwrap();
        let conn = test_conn();
        let id = insert_artifact(&conn, "settings", path.to_str().unwrap());

        let err = read_source(&conn, id).expect_err("only skills open here");
        assert!(err.contains("can't be edited here"), "got: {err}");
    }

    #[test]
    fn reading_a_directory_is_refused() {
        let dir = tempfile::tempdir().unwrap();
        let conn = test_conn();
        let id = insert_artifact(&conn, "skill", dir.path().to_str().unwrap());

        let err = read_source(&conn, id).expect_err("a directory is not a file");
        assert!(err.contains("not a file"), "got: {err}");
    }

    #[test]
    fn reading_a_file_over_the_cap_is_refused() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("SKILL.md");
        std::fs::write(&path, "x".repeat(MAX_BYTES + 1)).unwrap();
        let conn = test_conn();
        let id = insert_artifact(&conn, "skill", path.to_str().unwrap());

        let err = read_source(&conn, id).expect_err("over the cap");
        assert!(err.contains("too large to open"), "got: {err}");
    }

    #[test]
    fn saving_writes_the_file_and_refreshes_the_stored_byte_count() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("SKILL.md");
        std::fs::write(&path, "old").unwrap();
        let conn = test_conn();
        let id = insert_artifact(&conn, "skill", path.to_str().unwrap());

        let saved = write_source(&conn, id, "brand new body").unwrap();

        assert_eq!(std::fs::read_to_string(&path).unwrap(), "brand new body");
        assert_eq!(saved.bytes, 14);
        let stored: i32 = conn
            .query_row("SELECT bytes FROM artifacts WHERE id = ?1", [id], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(stored, 14);
    }

    /// The stale hash is what tells the next scan the file changed. Refreshing
    /// it here would strand the skill's grade and description on the old text.
    #[test]
    fn saving_leaves_the_hash_stale_so_the_next_scan_re_reads_the_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("SKILL.md");
        std::fs::write(&path, "old").unwrap();
        let conn = test_conn();
        let id = insert_artifact(&conn, "skill", path.to_str().unwrap());

        write_source(&conn, id, "new").unwrap();

        let hash: String = conn
            .query_row("SELECT hash FROM artifacts WHERE id = ?1", [id], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(hash, "stale-hash");
    }

    #[test]
    fn saving_a_non_skill_artifact_is_refused_without_touching_the_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        std::fs::write(&path, "{}").unwrap();
        let conn = test_conn();
        let id = insert_artifact(&conn, "settings", path.to_str().unwrap());

        let err = write_source(&conn, id, "clobbered").expect_err("only skills save here");

        assert!(err.contains("can't be edited here"), "got: {err}");
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "{}");
    }

    #[test]
    fn saving_an_unknown_artifact_id_is_an_error() {
        let conn = test_conn();
        let err = write_source(&conn, 9999, "x").expect_err("no such artifact");
        assert!(err.contains("no longer in the inventory"), "got: {err}");
    }

    #[test]
    fn saving_over_the_cap_is_refused_without_touching_the_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("SKILL.md");
        std::fs::write(&path, "small").unwrap();
        let conn = test_conn();
        let id = insert_artifact(&conn, "skill", path.to_str().unwrap());

        let err = write_source(&conn, id, &"x".repeat(MAX_BYTES + 1)).expect_err("over the cap");

        assert!(err.contains("too large to save"), "got: {err}");
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "small");
    }

    /// A skill deleted between the scan and the save must not be recreated by
    /// saving the panel's copy of it.
    #[test]
    fn saving_a_file_that_has_since_been_deleted_does_not_recreate_it() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("SKILL.md");
        std::fs::write(&path, "here").unwrap();
        let conn = test_conn();
        let id = insert_artifact(&conn, "skill", path.to_str().unwrap());
        std::fs::remove_file(&path).unwrap();

        let err = write_source(&conn, id, "back from the dead").expect_err("gone is gone");

        assert!(err.contains("no longer on disk"), "got: {err}");
        assert!(!path.exists());
    }
}
