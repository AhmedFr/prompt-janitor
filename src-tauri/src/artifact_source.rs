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
    /// The file's modification time when it was read, as an opaque stamp.
    ///
    /// Handed back on save so a write can tell "the file I was shown" from
    /// "the file as it is now". Opaque on purpose: nothing but equality is
    /// ever asked of it, so its format is free to change.
    pub modified: String,
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
        modified: stamp_of(&meta),
    })
}

/// An opaque equality token for a file's modification time.
///
/// Nanoseconds since the epoch, as a string. A filesystem that cannot report
/// an mtime at all yields an empty stamp, which compares unequal to nothing
/// and so simply never blocks a save — the guard degrades to absent rather
/// than to a refusal the user cannot clear.
fn stamp_of(meta: &std::fs::Metadata) -> String {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_nanos().to_string())
        .unwrap_or_default()
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
    expected_modified: Option<&str>,
) -> Result<ArtifactSaved, String> {
    let path = editable_path(conn, artifact_id)?;
    if content.len() > MAX_BYTES {
        return Err("That's too large to save.".to_string());
    }
    // Refuse to create a file that the scan found and something has since
    // removed: the user thinks they are editing a skill that exists, and
    // writing it back would resurrect it somewhere the harness may no longer
    // look.
    let meta =
        std::fs::metadata(&path).map_err(|_| "That file is no longer on disk.".to_string())?;
    if !meta.is_file() {
        return Err("That file is no longer on disk.".to_string());
    }

    // A skill can be edited by the harness, an editor, or a plugin update
    // while the panel holds it open. There is no undo here, so a save that
    // silently discarded someone else's work would be unrecoverable — refuse
    // instead, and let the caller decide. `None` is the deliberate override.
    if let Some(expected) = expected_modified {
        let now = stamp_of(&meta);
        if !expected.is_empty() && !now.is_empty() && expected != now {
            return Err(
                "That file changed on disk since you opened it. Reopen it to see the new version."
                    .to_string(),
            );
        }
    }

    write_atomically(&path, content)?;

    let bytes = content.len() as i32;
    conn.execute(
        "UPDATE artifacts SET bytes = ?1 WHERE id = ?2",
        rusqlite::params![bytes, artifact_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(ArtifactSaved { bytes })
}

/// Writes `content` to `path` via a sibling temp file and a rename.
///
/// `fs::write` truncates first and writes after, so a failure in between —
/// a full disk, a killed process — leaves the user's skill truncated or
/// empty while the error message still says the save did not happen. There
/// is no undo to recover from that. A rename is atomic on the same
/// filesystem, so the visible file only ever holds a complete version, and
/// the temp file is a sibling precisely so the rename never crosses one.
fn write_atomically(path: &str, content: &str) -> Result<(), String> {
    let target = std::path::Path::new(path);
    let dir = target
        .parent()
        .ok_or("That file has no parent directory.")?;
    let name = target
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("That file has no name.")?;
    let temp = dir.join(format!(".{name}.pj-tmp"));

    std::fs::write(&temp, content).map_err(|e| format!("Couldn't save the file: {e}"))?;
    std::fs::rename(&temp, target).map_err(|e| {
        // The rename is what makes the write visible; if it fails, nothing has
        // changed on disk, but the temp file would linger.
        let _ = std::fs::remove_file(&temp);
        format!("Couldn't save the file: {e}")
    })
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

    /// The panel has to be able to tell "the file I was handed" from "the file
    /// as it is now", or a save silently clobbers whatever changed underneath.
    #[test]
    fn a_read_reports_the_files_modification_stamp() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("SKILL.md");
        std::fs::write(&path, "one").unwrap();
        let conn = test_conn();
        let id = insert_artifact(&conn, "skill", path.to_str().unwrap());

        let first = read_source(&conn, id).unwrap();
        assert!(!first.modified.is_empty());

        // A rewrite must change the stamp, or it cannot detect anything.
        std::thread::sleep(std::time::Duration::from_millis(20));
        std::fs::write(&path, "two").unwrap();
        let second = read_source(&conn, id).unwrap();
        assert_ne!(first.modified, second.modified);
    }

    #[test]
    fn saving_with_the_stamp_from_the_read_succeeds() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("SKILL.md");
        std::fs::write(&path, "old").unwrap();
        let conn = test_conn();
        let id = insert_artifact(&conn, "skill", path.to_str().unwrap());
        let source = read_source(&conn, id).unwrap();

        write_source(&conn, id, "new", Some(&source.modified)).unwrap();

        assert_eq!(std::fs::read_to_string(&path).unwrap(), "new");
    }

    /// The whole point: something else edited the skill while the panel had it
    /// open, and there is no undo to fall back on.
    #[test]
    fn saving_over_a_file_that_changed_since_the_read_is_refused() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("SKILL.md");
        std::fs::write(&path, "old").unwrap();
        let conn = test_conn();
        let id = insert_artifact(&conn, "skill", path.to_str().unwrap());
        let source = read_source(&conn, id).unwrap();

        std::thread::sleep(std::time::Duration::from_millis(20));
        std::fs::write(&path, "changed by someone else").unwrap();

        let err = write_source(&conn, id, "mine", Some(&source.modified))
            .expect_err("the file moved underneath us");

        assert!(err.contains("changed on disk"), "got: {err}");
        assert_eq!(
            std::fs::read_to_string(&path).unwrap(),
            "changed by someone else"
        );
    }

    /// `None` is the deliberate override — the user was shown the conflict and
    /// chose to overwrite anyway.
    #[test]
    fn saving_without_a_stamp_overwrites_deliberately() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("SKILL.md");
        std::fs::write(&path, "old").unwrap();
        let conn = test_conn();
        let id = insert_artifact(&conn, "skill", path.to_str().unwrap());

        write_source(&conn, id, "forced", None).unwrap();

        assert_eq!(std::fs::read_to_string(&path).unwrap(), "forced");
    }

    /// A crash or a full disk mid-write must not leave a truncated skill. The
    /// write goes to a sibling temp file and is renamed into place, so the
    /// visible file only ever holds a complete version.
    #[test]
    fn saving_leaves_no_temp_file_behind() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("SKILL.md");
        std::fs::write(&path, "old").unwrap();
        let conn = test_conn();
        let id = insert_artifact(&conn, "skill", path.to_str().unwrap());

        write_source(&conn, id, "new", None).unwrap();

        let left: Vec<_> = std::fs::read_dir(dir.path())
            .unwrap()
            .map(|e| e.unwrap().file_name())
            .collect();
        assert_eq!(left, vec!["SKILL.md"], "a temp file survived the save");
    }

    #[test]
    fn saving_writes_the_file_and_refreshes_the_stored_byte_count() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("SKILL.md");
        std::fs::write(&path, "old").unwrap();
        let conn = test_conn();
        let id = insert_artifact(&conn, "skill", path.to_str().unwrap());

        let saved = write_source(&conn, id, "brand new body", None).unwrap();

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

        write_source(&conn, id, "new", None).unwrap();

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

        let err = write_source(&conn, id, "clobbered", None).expect_err("only skills save here");

        assert!(err.contains("can't be edited here"), "got: {err}");
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "{}");
    }

    #[test]
    fn saving_an_unknown_artifact_id_is_an_error() {
        let conn = test_conn();
        let err = write_source(&conn, 9999, "x", None).expect_err("no such artifact");
        assert!(err.contains("no longer in the inventory"), "got: {err}");
    }

    #[test]
    fn saving_over_the_cap_is_refused_without_touching_the_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("SKILL.md");
        std::fs::write(&path, "small").unwrap();
        let conn = test_conn();
        let id = insert_artifact(&conn, "skill", path.to_str().unwrap());

        let err =
            write_source(&conn, id, &"x".repeat(MAX_BYTES + 1), None).expect_err("over the cap");

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

        let err = write_source(&conn, id, "back from the dead", None).expect_err("gone is gone");

        assert!(err.contains("no longer on disk"), "got: {err}");
        assert!(!path.exists());
    }
}
