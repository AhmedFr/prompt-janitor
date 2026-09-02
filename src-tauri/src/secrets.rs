//! Where secrets live: the macOS Keychain, behind a small [`SecretStore`]
//! seam so the rest of the app never touches the platform API directly and
//! tests run against an in-memory store.
//!
//! The AI provider key used to be a plaintext row in the SQLite `settings`
//! table, readable by any process running as the user and carried into every
//! backup of Application Support (audit finding M-2). It is now one Keychain
//! item per provider, named `ai_key.<provider>`, under the app's bundle
//! identifier as the service. Per-provider matters: a single shared key meant
//! switching provider with the field left blank sent the previous vendor's
//! secret to the new vendor as a bearer token.
//!
//! [`migrate_legacy_ai_key`] moves an existing row into the Keychain on the
//! first launch after this change and vacuums the database so the plaintext
//! does not linger in free pages.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Keychain service name — the bundle identifier from `tauri.conf.json`, so
/// Keychain Access groups the entries under the app. Keep the two in step:
/// a changed identifier here orphans every user's stored key.
pub const SERVICE: &str = "com.promptjanitor.app";

/// Legacy settings row the key used to live in. Only read by the migration.
pub const LEGACY_SETTING: &str = "ai_key";

/// The Keychain item name for a provider's key.
pub fn ai_key_name(provider: &str) -> String {
    format!("ai_key.{provider}")
}

/// A named-secret store. Names are opaque here; callers build them with
/// [`ai_key_name`]. Every method is infallible on "absent": `get` of a
/// missing name is `Ok(None)`, `delete` of a missing name is `Ok(())`.
pub trait SecretStore: Send + Sync {
    fn get(&self, name: &str) -> Result<Option<String>, String>;
    fn set(&self, name: &str, value: &str) -> Result<(), String>;
    fn delete(&self, name: &str) -> Result<(), String>;
    /// Whether a value survives a restart. The migration deletes the only
    /// other copy of the key, so it must refuse a store that forgets.
    fn persistent(&self) -> bool;
}

/// Tauri managed state wrapping whichever store the platform provides.
pub struct Secrets(pub Arc<dyn SecretStore>);

/// In-memory store for tests and for platforms without a Keychain backend.
/// Not persistent: it forgets everything at exit, and says so.
#[derive(Default)]
pub struct MemoryStore {
    items: Mutex<HashMap<String, String>>,
    /// Tests that exercise the migration need a store that *claims* to keep
    /// values; nothing outside tests should ever construct one.
    claims_persistent: bool,
}

impl MemoryStore {
    #[cfg(test)]
    pub fn persistent_for_tests() -> Self {
        Self {
            items: Mutex::default(),
            claims_persistent: true,
        }
    }
}

impl SecretStore for MemoryStore {
    fn get(&self, name: &str) -> Result<Option<String>, String> {
        Ok(self
            .items
            .lock()
            .map_err(|e| e.to_string())?
            .get(name)
            .cloned())
    }
    fn set(&self, name: &str, value: &str) -> Result<(), String> {
        self.items
            .lock()
            .map_err(|e| e.to_string())?
            .insert(name.to_string(), value.to_string());
        Ok(())
    }
    fn delete(&self, name: &str) -> Result<(), String> {
        self.items.lock().map_err(|e| e.to_string())?.remove(name);
        Ok(())
    }
    fn persistent(&self) -> bool {
        self.claims_persistent
    }
}

/// The login Keychain, through `keyring-core` + the Apple store. Items are
/// generic passwords with service [`SERVICE`] and the name as account, so
/// they show up in Keychain Access under the app's identifier.
///
/// The Keychain ties an item to the code signature that created it: a debug
/// build reading an item the signed release build wrote (or vice versa) gets
/// a one-time "wants to access" prompt. Normal for macOS, worth knowing in
/// dev.
#[cfg(target_os = "macos")]
pub struct KeychainStore;

#[cfg(target_os = "macos")]
impl KeychainStore {
    /// Register the Apple store as `keyring-core`'s default exactly once.
    pub fn new() -> Result<Self, String> {
        use std::sync::OnceLock;
        static INIT: OnceLock<Result<(), String>> = OnceLock::new();
        INIT.get_or_init(|| {
            let store: Arc<keyring_core::CredentialStore> =
                apple_native_keyring_store::keychain::Store::new().map_err(|e| e.to_string())?;
            keyring_core::set_default_store(store);
            Ok(())
        })
        .clone()?;
        Ok(Self)
    }

    fn entry(name: &str) -> Result<keyring_core::Entry, String> {
        keyring_core::Entry::new(SERVICE, name).map_err(|e| e.to_string())
    }
}

#[cfg(target_os = "macos")]
impl SecretStore for KeychainStore {
    fn get(&self, name: &str) -> Result<Option<String>, String> {
        match Self::entry(name)?.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring_core::Error::NoEntry) => Ok(None),
            Err(e) => Err(format!("Couldn't read {name} from the Keychain: {e}")),
        }
    }
    fn set(&self, name: &str, value: &str) -> Result<(), String> {
        Self::entry(name)?
            .set_password(value)
            .map_err(|e| format!("Couldn't save {name} to the Keychain: {e}"))
    }
    fn delete(&self, name: &str) -> Result<(), String> {
        match Self::entry(name)?.delete_credential() {
            Ok(()) | Err(keyring_core::Error::NoEntry) => Ok(()),
            Err(e) => Err(format!("Couldn't remove {name} from the Keychain: {e}")),
        }
    }
    fn persistent(&self) -> bool {
        true
    }
}

/// The store this build uses: the login Keychain on macOS, memory elsewhere.
///
/// A Keychain that cannot even be opened falls back to memory for the
/// session — the app keeps working, the key just does not survive a restart —
/// and says so on stderr.
pub fn platform_store() -> Arc<dyn SecretStore> {
    #[cfg(target_os = "macos")]
    {
        match KeychainStore::new() {
            Ok(store) => return Arc::new(store),
            Err(e) => {
                eprintln!("Keychain unavailable, keeping secrets in memory for this session: {e}")
            }
        }
    }
    Arc::new(MemoryStore::default())
}

/// Move a legacy plaintext `ai_key` row into the store under the current
/// provider, delete the row, and scrub the database files. Returns
/// `Ok(true)` when the row was removed, `Ok(false)` when there was nothing
/// to do or the store is not one that survives a restart. On a store failure
/// the row is left in place (the key must not be lost) and the error
/// returned, so the next launch retries.
pub fn migrate_legacy_ai_key(
    conn: &rusqlite::Connection,
    store: &dyn SecretStore,
) -> Result<bool, String> {
    let Some(key) = crate::query::get_setting(conn, LEGACY_SETTING).map_err(|e| e.to_string())?
    else {
        return Ok(false);
    };
    if !store.persistent() {
        eprintln!("Leaving the AI key in the database: no persistent secret store is available.");
        return Ok(false);
    }
    let provider = crate::query::get_setting(conn, "ai_provider")
        .map_err(|e| e.to_string())?
        .unwrap_or_default();
    // A key whose provider is "none" or no longer registered cannot be used
    // by anything; keeping it in plaintext "to be safe" would defeat the
    // point of the move.
    if !key.is_empty() && crate::ai::provider::provider_ids().contains(&provider.as_str()) {
        store.set(&ai_key_name(&provider), &key)?;
    }
    // `secure_delete` zeroes the row's bytes as they are freed. The row is
    // gone at this point whatever happens below; the scrub is best effort.
    conn.execute_batch("PRAGMA secure_delete = ON;")
        .map_err(|e| e.to_string())?;
    crate::query::delete_setting(conn, LEGACY_SETTING).map_err(|e| e.to_string())?;
    // A deleted row stays readable in free pages until the file is rewritten,
    // and in WAL mode its frames stay readable in `-wal` until that log is
    // truncated, which a plain checkpoint does not do.
    if let Err(e) = conn.execute_batch("VACUUM; PRAGMA wal_checkpoint(TRUNCATE);") {
        eprintln!("The AI key moved to the Keychain but the database could not be scrubbed: {e}");
    }
    Ok(true)
}

/// Delete every provider's key. Used by reset and uninstall, which wipe the
/// database and would otherwise leave the secrets behind. Every name is
/// attempted; the error, if any, names the ones that could not be removed.
pub fn clear_ai_keys(store: &dyn SecretStore) -> Result<usize, String> {
    let ids = crate::ai::provider::provider_ids();
    let mut failed = Vec::new();
    for id in &ids {
        let name = ai_key_name(id);
        if let Err(e) = store.delete(&name) {
            failed.push(format!("{name}: {e}"));
        }
    }
    if failed.is_empty() {
        Ok(ids.len())
    } else {
        Err(failed.join("; "))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::query::{get_setting, set_setting};

    fn conn() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        conn
    }

    #[test]
    fn names_are_scoped_per_provider() {
        assert_eq!(ai_key_name("anthropic"), "ai_key.anthropic");
        assert_ne!(ai_key_name("anthropic"), ai_key_name("openai"));
    }

    #[test]
    fn memory_store_round_trips_and_treats_absent_as_none() {
        let store = MemoryStore::default();
        assert_eq!(store.get("ai_key.anthropic").unwrap(), None);
        store.set("ai_key.anthropic", "sk-ant-1").unwrap();
        assert_eq!(
            store.get("ai_key.anthropic").unwrap().as_deref(),
            Some("sk-ant-1")
        );
        store.set("ai_key.anthropic", "sk-ant-2").unwrap();
        assert_eq!(
            store.get("ai_key.anthropic").unwrap().as_deref(),
            Some("sk-ant-2")
        );
        store.delete("ai_key.anthropic").unwrap();
        assert_eq!(store.get("ai_key.anthropic").unwrap(), None);
        // Deleting what is not there is not an error.
        store.delete("ai_key.anthropic").unwrap();
    }

    #[test]
    fn migration_moves_the_legacy_row_under_the_current_provider_and_removes_it() {
        let conn = conn();
        let store = MemoryStore::persistent_for_tests();
        set_setting(&conn, "ai_provider", "openai").unwrap();
        set_setting(&conn, LEGACY_SETTING, "sk-legacy").unwrap();

        assert!(migrate_legacy_ai_key(&conn, &store).unwrap());

        assert_eq!(
            store.get(&ai_key_name("openai")).unwrap().as_deref(),
            Some("sk-legacy")
        );
        assert_eq!(get_setting(&conn, LEGACY_SETTING).unwrap(), None);
        // Second run is a no-op.
        assert!(!migrate_legacy_ai_key(&conn, &store).unwrap());
    }

    #[test]
    fn migration_is_a_no_op_without_a_legacy_row() {
        let conn = conn();
        let store = MemoryStore::default();
        assert!(!migrate_legacy_ai_key(&conn, &store).unwrap());
        assert_eq!(store.get(&ai_key_name("anthropic")).unwrap(), None);
    }

    #[test]
    fn migration_drops_a_key_that_belongs_to_no_provider() {
        // A key with "none" selected cannot be used by anything; keeping it
        // in plaintext to be safe would defeat the point of the move.
        let conn = conn();
        let store = MemoryStore::persistent_for_tests();
        set_setting(&conn, LEGACY_SETTING, "sk-orphan").unwrap();

        assert!(migrate_legacy_ai_key(&conn, &store).unwrap());

        assert_eq!(get_setting(&conn, LEGACY_SETTING).unwrap(), None);
        for id in crate::ai::provider::provider_ids() {
            assert_eq!(store.get(&ai_key_name(id)).unwrap(), None);
        }
    }

    struct FailingStore;
    impl SecretStore for FailingStore {
        fn get(&self, _: &str) -> Result<Option<String>, String> {
            Err("keychain locked".into())
        }
        fn set(&self, _: &str, _: &str) -> Result<(), String> {
            Err("keychain locked".into())
        }
        fn delete(&self, name: &str) -> Result<(), String> {
            Err(format!("cannot delete {name}"))
        }
        fn persistent(&self) -> bool {
            true
        }
    }

    #[test]
    fn migration_refuses_to_move_a_key_into_a_store_that_forgets_on_restart() {
        // The memory fallback exists so the app keeps working when the
        // Keychain cannot be opened. Moving the only copy of the key into it
        // and deleting the row would lose the key at the next launch.
        let conn = conn();
        let store = MemoryStore::default();
        assert!(!store.persistent());
        set_setting(&conn, "ai_provider", "anthropic").unwrap();
        set_setting(&conn, LEGACY_SETTING, "sk-keep").unwrap();

        assert!(!migrate_legacy_ai_key(&conn, &store).unwrap());

        assert_eq!(
            get_setting(&conn, LEGACY_SETTING).unwrap().as_deref(),
            Some("sk-keep")
        );
        assert_eq!(store.get(&ai_key_name("anthropic")).unwrap(), None);
    }

    #[test]
    fn migration_drops_a_key_whose_provider_is_not_registered() {
        let conn = conn();
        let store = MemoryStore::persistent_for_tests();
        set_setting(&conn, "ai_provider", "a-provider-we-removed").unwrap();
        set_setting(&conn, LEGACY_SETTING, "sk-orphan").unwrap();

        assert!(migrate_legacy_ai_key(&conn, &store).unwrap());

        assert_eq!(get_setting(&conn, LEGACY_SETTING).unwrap(), None);
        assert_eq!(
            store.get(&ai_key_name("a-provider-we-removed")).unwrap(),
            None
        );
    }

    /// The row's bytes must be gone from the file *and* the write-ahead log:
    /// a checkpoint copies pages into the main file but leaves the frames in
    /// `-wal` readable until it is truncated.
    #[test]
    fn migration_leaves_no_trace_of_the_key_in_the_database_files() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("pj.db");
        let conn = crate::store::init_db(&path).unwrap();
        let store = MemoryStore::persistent_for_tests();
        set_setting(&conn, "ai_provider", "anthropic").unwrap();
        set_setting(&conn, LEGACY_SETTING, "sk-needle-7f3a9c").unwrap();

        assert!(migrate_legacy_ai_key(&conn, &store).unwrap());

        let needle = b"sk-needle-7f3a9c";
        for suffix in ["", "-wal", "-shm"] {
            let file = std::path::PathBuf::from(format!("{}{suffix}", path.display()));
            if !file.exists() {
                continue;
            }
            let bytes = std::fs::read(&file).unwrap();
            assert!(
                !bytes.windows(needle.len()).any(|w| w == needle),
                "{} still contains the key",
                file.display()
            );
        }
        assert_eq!(
            store.get(&ai_key_name("anthropic")).unwrap().as_deref(),
            Some("sk-needle-7f3a9c")
        );
    }

    #[test]
    fn clearing_keeps_going_past_a_failure_and_names_what_it_could_not_remove() {
        let err = clear_ai_keys(&FailingStore).unwrap_err();
        for id in crate::ai::provider::provider_ids() {
            assert!(err.contains(&ai_key_name(id)), "{err}");
        }
    }

    #[test]
    fn migration_keeps_the_row_when_the_store_refuses_the_key() {
        let conn = conn();
        set_setting(&conn, "ai_provider", "anthropic").unwrap();
        set_setting(&conn, LEGACY_SETTING, "sk-keep").unwrap();

        let err = migrate_legacy_ai_key(&conn, &FailingStore).unwrap_err();

        assert!(err.contains("keychain locked"), "{err}");
        assert_eq!(
            get_setting(&conn, LEGACY_SETTING).unwrap().as_deref(),
            Some("sk-keep")
        );
    }

    #[test]
    fn clearing_removes_every_provider_key_and_counts_them() {
        let store = MemoryStore::default();
        store.set(&ai_key_name("anthropic"), "a").unwrap();
        store.set(&ai_key_name("openrouter"), "b").unwrap();

        let removed = clear_ai_keys(&store).unwrap();

        assert_eq!(removed, crate::ai::provider::provider_ids().len());
        for id in crate::ai::provider::provider_ids() {
            assert_eq!(store.get(&ai_key_name(id)).unwrap(), None);
        }
    }

    /// Talks to the real login Keychain; run by hand with
    /// `cargo test keychain_round_trip -- --ignored` on a Mac.
    #[cfg(target_os = "macos")]
    #[test]
    #[ignore]
    fn keychain_round_trip() {
        let store = platform_store();
        let name = format!("ai_key.test-{}", std::process::id());
        assert_eq!(store.get(&name).unwrap(), None);
        store.set(&name, "sk-test").unwrap();
        assert_eq!(store.get(&name).unwrap().as_deref(), Some("sk-test"));
        store.delete(&name).unwrap();
        assert_eq!(store.get(&name).unwrap(), None);
    }
}
