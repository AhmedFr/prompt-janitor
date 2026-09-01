//! The danger zone: wiping the app's local state, and removing the app itself.
//!
//! Both actions are irreversible, so both are deliberately narrow. "Reset"
//! touches exactly the files this app wrote into its own app-data directory
//! and leaves the app running on a fresh, seeded database. "Uninstall" does
//! that, then asks Finder to move the running bundle to the Trash — where the
//! user can still get it back — rather than deleting it outright.
//!
//! Neither one ever touches a scanned project: Prompt Janitor reads prompt
//! files where they live and only writes its findings here.

use std::path::{Path, PathBuf};

use tauri::{AppHandle, Emitter, Manager};

use crate::store::{self, AppDb};

/// File name of the SQLite database inside the app-data directory.
pub const DB_FILE_NAME: &str = "prompt-janitor.db";

/// How long the uninstall waits before quitting, so the IPC reply reaches the
/// window that asked. Long enough for a local round trip, short enough that
/// the user reads it as "the app quit", not "the app hung".
const QUIT_DELAY_MS: u64 = 600;

/// Every path under the app-data directory that this app owns, filtered to the
/// ones that actually exist.
///
/// Derived from the database path rather than "everything in the directory":
/// the app-data directory belongs to the bundle identifier, and a blind
/// `remove_dir_all` would take anything a future sibling process put there
/// with it.
///
/// Today that is the database and the two files SQLite keeps beside it in WAL
/// mode. `backup/` is listed because undo snapshots are the one piece of state
/// that could plausibly move out of the database and onto disk; it simply does
/// not exist yet, and a path that does not exist is skipped.
pub fn data_paths_for_db(db_path: &Path) -> Vec<PathBuf> {
    let mut candidates = vec![
        db_path.to_path_buf(),
        with_suffix(db_path, "-wal"),
        with_suffix(db_path, "-shm"),
    ];
    if let Some(dir) = db_path.parent() {
        candidates.push(dir.join("backup"));
    }
    candidates.retain(|path| path.exists());
    candidates
}

/// `foo.db` + `-wal` → `foo.db-wal`, which is how SQLite names them.
fn with_suffix(path: &Path, suffix: &str) -> PathBuf {
    let mut name = path.as_os_str().to_os_string();
    name.push(suffix);
    PathBuf::from(name)
}

/// The app-data paths for the running app.
pub fn app_data_paths(app: &AppHandle) -> Vec<PathBuf> {
    match app.path().app_data_dir() {
        Ok(dir) => data_paths_for_db(&dir.join(DB_FILE_NAME)),
        Err(_) => Vec::new(),
    }
}

/// Remove `paths`, ignoring anything already gone. Returns how many went.
fn remove_all(paths: &[PathBuf]) -> usize {
    paths
        .iter()
        .filter(|path| {
            if path.is_dir() {
                std::fs::remove_dir_all(path).is_ok()
            } else {
                std::fs::remove_file(path).is_ok()
            }
        })
        .count()
}

/// The `.app` bundle a running binary lives inside, if it lives inside one.
///
/// A bundled macOS binary sits at `<Name>.app/Contents/MacOS/<bin>`, so the
/// bundle is three levels up. A development build (`target/release/…`, or the
/// binary `pnpm tauri dev` launches) is three levels below something that is
/// not a bundle, and must never be mistaken for one — trashing a `release`
/// directory would take the whole build tree with it.
pub fn bundle_path_from_binary(binary: &Path) -> Option<PathBuf> {
    let macos = binary.parent()?;
    let contents = macos.parent()?;
    let bundle = contents.parent()?;
    // `Contents/MacOS` is as much a part of the shape as the `.app` suffix;
    // checking only the suffix would accept `Foo.app/bin/prompt-janitor`.
    if macos.file_name()? != "MacOS" || contents.file_name()? != "Contents" {
        return None;
    }
    if bundle.extension()? != "app" {
        return None;
    }
    Some(bundle.to_path_buf())
}

/// Ask Finder to move `bundle` to the Trash, so it stays recoverable.
#[cfg(target_os = "macos")]
fn trash_bundle(bundle: &Path) -> Result<(), String> {
    let script = format!(
        "tell application \"Finder\" to delete POSIX file \"{}\"",
        bundle.display()
    );
    let output = std::process::Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| format!("could not run osascript: {e}"))?;
    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

/// Delete the local database, backups and settings, then come back up on a
/// fresh one so the app keeps working.
///
/// The pooled connection is swapped for an in-memory database *before* the
/// files go: on Windows an open handle blocks the delete outright, and on
/// macOS the old connection would keep writing WAL frames to a file nobody is
/// reading any more. The fresh database is opened through the same
/// [`store::init_db`] a cold launch uses, so it is seeded identically.
#[tauri::command]
#[specta::specta]
pub fn reset_app_data(app: AppHandle, db: tauri::State<'_, AppDb>) -> Result<String, String> {
    let db_path = PathBuf::from(&db.path);
    let paths = data_paths_for_db(&db_path);

    let mut conn = db.conn.lock().map_err(|e| e.to_string())?;
    // Dropping the old connection is what actually releases the file.
    *conn = rusqlite::Connection::open_in_memory().map_err(|e| e.to_string())?;

    let removed = remove_all(&paths);
    *conn = store::init_db(&db_path).map_err(|e| e.to_string())?;
    drop(conn);

    // Every screen refetches on `scan-done`; without it they would keep
    // rendering rows that no longer exist.
    let _ = app.emit("scan-done", ());

    Ok(format!(
        "Deleted {removed} local file{} and started a fresh database.",
        if removed == 1 { "" } else { "s" }
    ))
}

/// Remove every trace of the app: its data, then the bundle itself.
///
/// A development build is left where it is — there is no bundle to trash, and
/// the returned message says so rather than pretending the job is done. That
/// is also the only path that returns to a still-running app; a real uninstall
/// quits a moment after replying.
#[tauri::command]
#[specta::specta]
pub fn uninstall_app(app: AppHandle) -> Result<String, String> {
    let removed = remove_all(&app_data_paths(&app));
    let data = format!(
        "Removed {removed} local file{}.",
        if removed == 1 { "" } else { "s" }
    );

    #[cfg(target_os = "macos")]
    {
        let binary = tauri::process::current_binary(&app.env()).map_err(|e| e.to_string())?;
        let Some(bundle) = bundle_path_from_binary(&binary) else {
            return Ok(format!(
                "{data} This is a development build, so there is no app bundle to move to the Trash."
            ));
        };
        trash_bundle(&bundle)?;

        // Reply first, quit a beat later: `exit` tears down the window that is
        // waiting on this command's response.
        let handle = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(QUIT_DELAY_MS));
            handle.exit(0);
        });
        Ok(format!(
            "{data} Prompt Janitor is in the Trash. The app will quit now."
        ))
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok(format!(
            "{data} Automatic uninstall is only available on macOS — remove the application yourself."
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_bundled_binary_reports_the_app_it_lives_in() {
        let bundle = bundle_path_from_binary(Path::new(
            "/Applications/Prompt Janitor.app/Contents/MacOS/prompt-janitor",
        ));
        assert_eq!(
            bundle,
            Some(PathBuf::from("/Applications/Prompt Janitor.app"))
        );
    }

    #[test]
    fn a_release_build_in_the_tree_is_not_a_bundle() {
        // Trashing this would take `target/` — and the checkout around it.
        assert_eq!(
            bundle_path_from_binary(Path::new(
                "/Users/a/code/prompt-janitor/src-tauri/target/release/prompt-janitor"
            )),
            None
        );
    }

    #[test]
    fn a_dev_build_is_not_a_bundle() {
        assert_eq!(
            bundle_path_from_binary(Path::new(
                "/Users/a/code/prompt-janitor/src-tauri/target/debug/prompt-janitor"
            )),
            None
        );
    }

    /// The `.app` suffix alone is not the shape: only `Contents/MacOS` is.
    #[test]
    fn a_binary_somewhere_else_inside_a_bundle_is_rejected() {
        assert_eq!(
            bundle_path_from_binary(Path::new(
                "/Applications/Foo.app/Contents/bin/prompt-janitor"
            )),
            None
        );
    }

    #[test]
    fn a_path_too_shallow_to_be_a_bundle_is_rejected() {
        assert_eq!(bundle_path_from_binary(Path::new("/prompt-janitor")), None);
    }

    #[test]
    fn data_paths_list_the_database_and_what_sqlite_keeps_beside_it() {
        let dir = tempfile::tempdir().unwrap();
        let db = dir.path().join(DB_FILE_NAME);
        std::fs::write(&db, b"db").unwrap();
        std::fs::write(dir.path().join("prompt-janitor.db-wal"), b"wal").unwrap();
        std::fs::create_dir(dir.path().join("backup")).unwrap();

        let paths = data_paths_for_db(&db);

        assert!(paths.contains(&db));
        assert!(paths.contains(&dir.path().join("prompt-janitor.db-wal")));
        assert!(paths.contains(&dir.path().join("backup")));
        // -shm was never created; a path that does not exist is not listed.
        assert!(!paths.contains(&dir.path().join("prompt-janitor.db-shm")));
    }

    /// The directory belongs to the bundle identifier, not to this database:
    /// anything the app did not write stays put.
    #[test]
    fn data_paths_ignore_files_the_app_did_not_write() {
        let dir = tempfile::tempdir().unwrap();
        let db = dir.path().join(DB_FILE_NAME);
        std::fs::write(&db, b"db").unwrap();
        std::fs::write(dir.path().join("something-else.json"), b"{}").unwrap();

        let paths = data_paths_for_db(&db);

        assert_eq!(paths, vec![db]);
    }

    #[test]
    fn removing_takes_files_and_directories_and_shrugs_at_what_is_gone() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("a.db");
        let nested = dir.path().join("backup");
        std::fs::write(&file, b"x").unwrap();
        std::fs::create_dir(&nested).unwrap();
        std::fs::write(nested.join("b.txt"), b"y").unwrap();

        let removed = remove_all(&[file.clone(), nested.clone(), dir.path().join("absent")]);

        assert_eq!(removed, 2);
        assert!(!file.exists());
        assert!(!nested.exists());
    }
}
