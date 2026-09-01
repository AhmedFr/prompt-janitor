//! The danger zone: wiping the app's local state, and removing the app itself.
//!
//! Both actions are irreversible, so both are deliberately narrow. "Reset"
//! deletes exactly the files this app wrote and leaves it running on a fresh,
//! seeded database. "Uninstall" moves the running bundle to the Trash — where
//! the user can still get it back — and then clears the app-data directory.
//!
//! The order in `uninstall_app` is the safety property: the trash step runs
//! *first*, so a failure there leaves the user with a working app and all of
//! their data, rather than a wiped database and an app still on disk.
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
#[cfg(target_os = "macos")]
const QUIT_DELAY_MS: u64 = 600;

/// Every path under the app-data directory that this app owns, filtered to the
/// ones that actually exist.
///
/// Derived from the database path rather than "everything in the directory":
/// reset is the non-destructive half of this module, and a user who dropped a
/// file of their own next to the database should not lose it to a rescan of
/// their rule library. (Uninstall does clear the whole directory — but only
/// after [`is_app_data_dir`] confirms which directory it is, and only when the
/// app is on its way out anyway.)
pub fn data_paths_for_db(db_path: &Path) -> Vec<PathBuf> {
    let mut candidates = vec![
        db_path.to_path_buf(),
        with_suffix(db_path, "-wal"),
        with_suffix(db_path, "-shm"),
    ];
    candidates.retain(|path| path.exists());
    candidates
}

/// `foo.db` + `-wal` → `foo.db-wal`, which is how SQLite names them.
fn with_suffix(path: &Path, suffix: &str) -> PathBuf {
    let mut name = path.as_os_str().to_os_string();
    name.push(suffix);
    PathBuf::from(name)
}

/// Whether `dir` is the app-data directory `identifier` owns.
///
/// The only guard in front of this module's one `remove_dir_all`. A bug that
/// let `app_data_dir()` resolve to `~/Library/Application Support` — or to
/// `~` — would otherwise delete far more than this app's data, so the last
/// component has to be the bundle identifier and nothing else. An empty
/// identifier authorises nothing: it would otherwise match a directory whose
/// name is the empty string.
pub fn is_app_data_dir(dir: &Path, identifier: &str) -> bool {
    !identifier.is_empty() && dir.file_name().is_some_and(|name| name == identifier)
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

/// Where the running binary lives, as far as uninstall is concerned.
#[cfg(target_os = "macos")]
#[derive(Debug, PartialEq, Eq)]
pub enum BundleLocation {
    /// A real `.app` bundle at this path — safe to move to the Trash.
    Bundle(PathBuf),
    /// Gatekeeper is running the app from a read-only translocated copy. The
    /// path is a disposable mount, so trashing it accomplishes nothing.
    Translocated,
    /// A development build: `target/release/prompt-janitor`, or whatever
    /// `pnpm tauri dev` launched. There is no bundle to remove.
    Unbundled,
}

/// Classify the running binary's location.
///
/// A bundled macOS binary sits at `<Name>.app/Contents/MacOS/<bin>`, so the
/// bundle is three levels up. A development build is three levels below
/// something that is not a bundle, and must never be mistaken for one —
/// trashing a `release` directory would take the whole build tree with it.
#[cfg(target_os = "macos")]
pub fn bundle_location(binary: &Path) -> BundleLocation {
    let Some(bundle) = bundle_path_from_binary(binary) else {
        return BundleLocation::Unbundled;
    };
    // An app opened straight from a .dmg or the Downloads quarantine runs from
    // `…/AppTranslocation/<uuid>/d/Name.app`, a read-only mount that vanishes
    // on quit. Trashing it would report success and remove nothing the user
    // can see.
    if bundle
        .components()
        .any(|c| c.as_os_str() == "AppTranslocation")
    {
        return BundleLocation::Translocated;
    }
    BundleLocation::Bundle(bundle)
}

/// The `.app` bundle a running binary lives inside, if it lives inside one.
#[cfg(target_os = "macos")]
fn bundle_path_from_binary(binary: &Path) -> Option<PathBuf> {
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

/// Delete the local database and its settings, then come back up on a fresh
/// one so the app keeps working.
///
/// The pooled connection is swapped for an in-memory database *before* the
/// files are listed and deleted: on Windows an open handle blocks the delete
/// outright, on macOS the old connection would keep writing WAL frames to a
/// file nobody is reading any more, and closing it is also what checkpoints
/// and removes `-wal`/`-shm` — so a list taken beforehand would over-count.
/// The fresh database is opened through the same [`store::init_db`] a cold
/// launch uses, so it is seeded identically.
#[tauri::command]
#[specta::specta]
pub fn reset_app_data(app: AppHandle, db: tauri::State<'_, AppDb>) -> Result<String, String> {
    let db_path = PathBuf::from(&db.path);

    let mut conn = db.conn.lock().map_err(|e| e.to_string())?;
    // Dropping the old connection is what actually releases the file.
    *conn = rusqlite::Connection::open_in_memory().map_err(|e| e.to_string())?;

    let removed = remove_all(&data_paths_for_db(&db_path));
    *conn = store::init_db(&db_path).map_err(|e| {
        format!("Deleted the database but could not create a new one ({e}). Quit and reopen Prompt Janitor.")
    })?;
    drop(conn);

    // Every screen refetches on `scan-done`; without it they would keep
    // rendering rows that no longer exist.
    let _ = app.emit("scan-done", ());

    Ok(format!(
        "Deleted {removed} local file{} and started a fresh database.",
        if removed == 1 { "" } else { "s" }
    ))
}

/// Remove every trace of the app: the bundle first, then its data.
///
/// Bundle first on purpose. Trashing can fail — a read-only volume, a
/// translocated copy, a permissions refusal — and a user whose app is still
/// installed should still have their database. Nothing destructive happens
/// until the bundle is safely in the Trash.
///
/// A development build has no bundle to trash. It still clears its data (that
/// is the useful half in dev) and says what it did rather than pretending the
/// job is done; it is also the only path that returns to a still-running app.
#[tauri::command]
#[specta::specta]
pub fn uninstall_app(app: AppHandle, db: tauri::State<'_, AppDb>) -> Result<String, String> {
    // Step 1 — the reversible, non-destructive half.
    #[cfg(target_os = "macos")]
    let quitting = {
        let binary = tauri::process::current_binary(&app.env()).map_err(|e| e.to_string())?;
        match bundle_location(&binary) {
            BundleLocation::Translocated => {
                return Err(
                    "macOS is running Prompt Janitor from a temporary read-only copy, so it cannot \
                     be removed from here. Drag the app into your Applications folder, open it from \
                     there, and try again. Nothing was deleted."
                        .into(),
                );
            }
            BundleLocation::Bundle(bundle) => {
                trash::delete(&bundle).map_err(|e| {
                    format!(
                        "Could not move Prompt Janitor to the Trash ({e}). Drag it there yourself \
                         — your data has not been touched."
                    )
                })?;
                true
            }
            BundleLocation::Unbundled => false,
        }
    };
    #[cfg(not(target_os = "macos"))]
    let quitting = false;

    // Step 2 — the destructive half, now that the app is on its way out.
    let removed = clear_app_data(&app, &db)?;
    let data = format!(
        "Removed {removed} local file{}.",
        if removed == 1 { "" } else { "s" }
    );

    if !quitting {
        return Ok(format!(
            "{data} This is a development build, so there is no app bundle to move to the Trash."
        ));
    }

    // Reply first, quit a beat later: `exit` tears down the window that is
    // waiting on this command's response.
    #[cfg(target_os = "macos")]
    {
        let handle = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(QUIT_DELAY_MS));
            handle.exit(0);
        });
    }
    Ok(format!(
        "{data} Prompt Janitor is in the Trash. The app will quit now."
    ))
}

/// Empty the app-data directory, connection released first.
///
/// Unlike reset, this takes the whole directory: the app is leaving, so
/// anything it ever wrote should go with it. [`is_app_data_dir`] is what makes
/// that safe — without the check, a path resolution that ever returned the
/// parent directory would delete every app's data, not just ours.
fn clear_app_data(app: &AppHandle, db: &AppDb) -> Result<usize, String> {
    let Ok(dir) = app.path().app_data_dir() else {
        return Ok(0);
    };
    let identifier = &app.config().identifier;
    if !is_app_data_dir(&dir, identifier) {
        return Err(format!(
            "Refusing to delete {} — it is not {identifier}'s own data directory. Nothing was \
             removed.",
            dir.display()
        ));
    }

    // Same reason as reset: the delete has to happen with no open handle.
    let mut conn = db.conn.lock().map_err(|e| e.to_string())?;
    *conn = rusqlite::Connection::open_in_memory().map_err(|e| e.to_string())?;
    let count = std::fs::read_dir(&dir)
        .map(|entries| entries.count())
        .unwrap_or(0);
    std::fs::remove_dir_all(&dir)
        .map_err(|e| format!("Could not remove {} ({e}).", dir.display()))?;
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(target_os = "macos")]
    #[test]
    fn a_bundled_binary_reports_the_app_it_lives_in() {
        assert_eq!(
            bundle_location(Path::new(
                "/Applications/Prompt Janitor.app/Contents/MacOS/prompt-janitor"
            )),
            BundleLocation::Bundle(PathBuf::from("/Applications/Prompt Janitor.app"))
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn a_release_build_in_the_tree_is_not_a_bundle() {
        // Trashing this would take `target/` — and the checkout around it.
        assert_eq!(
            bundle_location(Path::new(
                "/Users/a/code/prompt-janitor/src-tauri/target/release/prompt-janitor"
            )),
            BundleLocation::Unbundled
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn a_dev_build_is_not_a_bundle() {
        assert_eq!(
            bundle_location(Path::new(
                "/Users/a/code/prompt-janitor/src-tauri/target/debug/prompt-janitor"
            )),
            BundleLocation::Unbundled
        );
    }

    /// The `.app` suffix alone is not the shape: only `Contents/MacOS` is.
    #[cfg(target_os = "macos")]
    #[test]
    fn a_binary_somewhere_else_inside_a_bundle_is_rejected() {
        assert_eq!(
            bundle_location(Path::new(
                "/Applications/Foo.app/Contents/bin/prompt-janitor"
            )),
            BundleLocation::Unbundled
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn a_path_too_shallow_to_be_a_bundle_is_rejected() {
        assert_eq!(
            bundle_location(Path::new("/prompt-janitor")),
            BundleLocation::Unbundled
        );
    }

    #[test]
    fn data_paths_list_the_database_and_what_sqlite_keeps_beside_it() {
        let dir = tempfile::tempdir().unwrap();
        let db = dir.path().join(DB_FILE_NAME);
        std::fs::write(&db, b"db").unwrap();
        std::fs::write(dir.path().join("prompt-janitor.db-wal"), b"wal").unwrap();

        let paths = data_paths_for_db(&db);

        assert!(paths.contains(&db));
        assert!(paths.contains(&dir.path().join("prompt-janitor.db-wal")));
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

    /// Gatekeeper for the one `remove_dir_all` in this file. Anything but the
    /// directory the bundle identifier owns has to be refused.
    #[test]
    fn only_the_identifier_s_own_directory_may_be_removed_wholesale() {
        let id = "com.promptjanitor.app";
        assert!(is_app_data_dir(
            Path::new("/Users/a/Library/Application Support/com.promptjanitor.app"),
            id
        ));
        // A trailing separator must not change the answer.
        assert!(is_app_data_dir(
            Path::new("/Users/a/Library/Application Support/com.promptjanitor.app/"),
            id
        ));
        assert!(!is_app_data_dir(
            Path::new("/Users/a/Library/Application Support"),
            id
        ));
        assert!(!is_app_data_dir(Path::new("/Users/a"), id));
        assert!(!is_app_data_dir(Path::new("/"), id));
        assert!(!is_app_data_dir(
            Path::new("/Users/a/Library/Application Support/com.someoneelse.app"),
            id
        ));
    }

    /// Gatekeeper's twin: the identifier itself is never allowed to be empty,
    /// or `is_app_data_dir` would accept a directory literally named "".
    #[test]
    fn an_empty_identifier_never_authorises_a_delete() {
        assert!(!is_app_data_dir(
            Path::new("/Users/a/Library/Application Support/com.promptjanitor.app"),
            ""
        ));
    }

    /// Gatekeeper's other twin: a translocated bundle must be told apart from
    /// a development build, because the two need different advice.
    #[cfg(target_os = "macos")]
    #[test]
    fn a_translocated_bundle_is_reported_as_such() {
        assert_eq!(
            bundle_location(Path::new(
                "/private/var/folders/9x/T/AppTranslocation/1B2C-3D/d/Prompt Janitor.app/Contents/MacOS/prompt-janitor"
            )),
            BundleLocation::Translocated
        );
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
