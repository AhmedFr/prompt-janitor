//! The capability files are the app's ACL, and a missing entry fails at
//! runtime as *silence* — a denied command whose JS promise rejects into a
//! `void` call, with nothing on screen to say so. Two such holes shipped in
//! v0.1.1: `core:window:default` is read-only, so no `start-dragging` was
//! granted and the window could not be dragged by its toolbars; and the
//! `panel` window had no capability at all, so its own `hide()`/`setSize()`
//! were denied too.
//!
//! These tests read the capability directory the way Tauri does. The load
//! bearing detail is that a window's permissions are the **union of every
//! capability naming it** — so asking "what may the panel do?" of `panel.json`
//! alone answers the wrong question: a second file naming the `panel` window
//! would widen it silently, and an earlier version of this file passed while
//! exactly that was true.

use std::collections::{BTreeSet, HashSet};
use std::path::{Path, PathBuf};

fn capabilities_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("capabilities")
}

/// Every `capabilities/*.json`, parsed — never a hardcoded list, so a new
/// capability file is covered the moment it is added.
fn capability_files() -> Vec<(String, serde_json::Value)> {
    let dir = capabilities_dir();
    let mut out: Vec<(String, serde_json::Value)> = std::fs::read_dir(&dir)
        .unwrap_or_else(|e| panic!("read {}: {e}", dir.display()))
        .map(|entry| entry.expect("read dir entry").path())
        .filter(|path| path.extension().is_some_and(|e| e == "json"))
        .map(|path| {
            let text = std::fs::read_to_string(&path)
                .unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
            let value = serde_json::from_str(&text)
                .unwrap_or_else(|e| panic!("parse {}: {e}", path.display()));
            (file_name(&path), value)
        })
        .collect();
    assert!(!out.is_empty(), "no capability files in {}", dir.display());
    out.sort_by(|a, b| a.0.cmp(&b.0));
    out
}

fn file_name(path: &Path) -> String {
    path.file_name()
        .and_then(|n| n.to_str())
        .expect("capability file name")
        .to_string()
}

/// Tauri's `windows` entries are glob patterns, not plain labels.
fn glob_matches(pattern: &str, label: &str) -> bool {
    let parts: Vec<&str> = pattern.split('*').collect();
    if parts.len() == 1 {
        return pattern == label;
    }
    let Some(mut rest) = label.strip_prefix(parts[0]) else {
        return false;
    };
    let last = parts.len() - 1;
    for (i, part) in parts.iter().enumerate().skip(1) {
        if i == last {
            return rest.len() >= part.len() && rest.ends_with(part);
        }
        match rest.find(part) {
            Some(idx) => rest = &rest[idx + part.len()..],
            None => return false,
        }
    }
    true
}

fn permissions_of(cap: &serde_json::Value, file: &str) -> Vec<String> {
    cap["permissions"]
        .as_array()
        .unwrap_or_else(|| panic!("{file}: permissions is a required array"))
        .iter()
        .map(|p| {
            p.as_str()
                .unwrap_or_else(|| panic!("{file}: permissions hold plain identifier strings"))
                .to_string()
        })
        .collect()
}

fn window_patterns(cap: &serde_json::Value) -> Vec<String> {
    match cap.get("windows").and_then(|w| w.as_array()) {
        // `windows` is optional in the schema. A capability that names none is
        // not obviously scoped to anything, so for a security test treat it as
        // reaching every window: this errs toward flagging, never toward a
        // silent pass.
        None => vec!["*".to_string()],
        Some(list) if list.is_empty() => vec!["*".to_string()],
        Some(list) => list
            .iter()
            .map(|w| w.as_str().expect("window patterns are strings").to_string())
            .collect(),
    }
}

/// What a window may actually do: the union over every capability naming it.
fn permissions_for_window(label: &str) -> BTreeSet<String> {
    let mut union = BTreeSet::new();
    for (file, cap) in capability_files() {
        if window_patterns(&cap).iter().any(|p| glob_matches(p, label)) {
            union.extend(permissions_of(&cap, &file));
        }
    }
    assert!(
        !union.is_empty(),
        "window `{label}` is named by no capability, so every IPC call from it is denied"
    );
    union
}

#[test]
fn main_window_may_start_dragging() {
    let perms = permissions_for_window("main");
    // `core:default` pulls in `core:window:default`, which is read-only: it
    // grants `allow-inner-size`, `allow-is-focused` and friends, but no
    // mutation at all. Every `data-tauri-drag-region` in the UI calls
    // `startDragging()` under the hood, so without this the app's whole
    // titlebar strip is dead.
    assert!(
        perms.contains("core:window:allow-start-dragging"),
        "the main window must be draggable; permissions were {perms:?}"
    );
}

#[test]
fn panel_may_hide_and_size_itself() {
    let perms = permissions_for_window("panel");
    // The popover hides itself on Esc and measures its card to `setSize`.
    for needed in [
        "core:default",
        "core:window:allow-hide",
        "core:window:allow-set-size",
    ] {
        assert!(
            perms.contains(needed),
            "the panel needs {needed}; permissions were {perms:?}"
        );
    }
}

#[test]
fn panel_permissions_are_exactly_the_pinned_set() {
    // The deny-list below names the classes of permission the panel must never
    // hold, but a list of prefixes can only forbid what it thought to name.
    // This pins the whole set instead, so anything new — `fs:`, `http:`,
    // `shell:`, another app command — has to be added here deliberately, in a
    // diff a reviewer sees.
    let expected: BTreeSet<String> = [
        "allow-get-panel-snapshot",
        "allow-open-main",
        "allow-quit",
        "allow-scan-now",
        "core:default",
        "core:window:allow-hide",
        "core:window:allow-set-size",
    ]
    .into_iter()
    .map(String::from)
    .collect();

    let actual = permissions_for_window("panel");
    assert_eq!(
        actual,
        expected,
        "the panel's permissions changed.\n  added:   {:?}\n  removed: {:?}",
        actual.difference(&expected).collect::<Vec<_>>(),
        expected.difference(&actual).collect::<Vec<_>>()
    );
}

#[test]
fn panel_gets_no_privileged_plugin_or_destructive_access() {
    let perms = permissions_for_window("panel");
    // The menu-bar popover is the app's most reachable surface — one click
    // from the menu bar, no window focus needed. It stays a read-and-scan
    // view: no updater, no process control, no file dialogs, no shell opener,
    // no filesystem or network reach, and neither destructive command.
    for prefix in [
        "updater:",
        "process:",
        "dialog:",
        "opener:",
        "notification:",
        "fs:",
        "http:",
        "shell:",
    ] {
        let leaked: Vec<_> = perms.iter().filter(|p| p.starts_with(prefix)).collect();
        assert!(
            leaked.is_empty(),
            "the panel must not hold `{prefix}` permissions, found {leaked:?}"
        );
    }
    for destructive in ["allow-reset-app-data", "allow-uninstall-app"] {
        assert!(
            !perms.contains(destructive),
            "the panel must not hold `{destructive}`"
        );
    }
}

#[test]
fn every_window_the_app_opens_is_covered_by_a_capability() {
    let conf: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tauri.conf.json"))
            .expect("read tauri.conf.json"),
    )
    .expect("parse tauri.conf.json");

    let mut labels: HashSet<String> = conf["app"]["windows"]
        .as_array()
        .expect("windows array")
        .iter()
        .map(|w| w["label"].as_str().expect("window label").to_string())
        .collect();
    // `panel` is created at runtime by the tray rather than declared in the
    // config, so the config cannot name it.
    labels.insert("panel".to_string());

    for label in labels {
        // Asserts non-empty internally, which is the coverage check.
        permissions_for_window(&label);
    }
}

#[test]
fn window_globs_match_the_way_tauri_reads_them() {
    // `permissions_for_window` is only as good as this: a capability scoped to
    // `main` must not be read as reaching `panel`.
    assert!(glob_matches("main", "main"));
    assert!(!glob_matches("main", "panel"));
    assert!(glob_matches("*", "panel"));
    assert!(glob_matches("pan*", "panel"));
    assert!(!glob_matches("pan*", "main"));
    assert!(glob_matches("*nel", "panel"));
    assert!(!glob_matches("*nel", "main"));
    assert!(glob_matches("p*l", "panel"));
    assert!(!glob_matches("p*l", "panes"));
}
