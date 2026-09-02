//! The capability files are the app's ACL, and a missing entry fails at
//! runtime as *silence* — a denied command whose JS promise rejects into a
//! `void` call, with nothing on screen to say so. Two such holes shipped in
//! v0.1.1: `core:window:default` is read-only, so no `start-dragging` was
//! granted and the window could not be dragged by its toolbars; and the
//! `panel` window had no capability at all, so its own `hide()`/`setSize()`
//! were denied too. These tests read the JSON the way Tauri does and pin
//! both the permissions that must be there and the ones that must not.

use std::collections::HashSet;
use std::path::PathBuf;

fn capability(name: &str) -> serde_json::Value {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("capabilities")
        .join(format!("{name}.json"));
    let text =
        std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
    serde_json::from_str(&text).unwrap_or_else(|e| panic!("parse {}: {e}", path.display()))
}

fn permissions(cap: &serde_json::Value) -> HashSet<String> {
    cap["permissions"]
        .as_array()
        .expect("permissions is an array")
        .iter()
        .map(|p| {
            p.as_str()
                .expect("permissions hold plain identifier strings")
                .to_string()
        })
        .collect()
}

fn windows(cap: &serde_json::Value) -> Vec<String> {
    cap["windows"]
        .as_array()
        .expect("windows is an array")
        .iter()
        .map(|w| w.as_str().expect("window labels are strings").to_string())
        .collect()
}

#[test]
fn main_window_may_start_dragging() {
    let perms = permissions(&capability("default"));
    // `core:default` pulls in `core:window:default`, which is read-only:
    // it grants `allow-inner-size`, `allow-is-focused` and friends, but no
    // mutation at all. Every `data-tauri-drag-region` in the UI calls
    // `startDragging()` under the hood, so without this the app's whole
    // titlebar strip is dead.
    assert!(
        perms.contains("core:window:allow-start-dragging"),
        "the main window must be draggable; permissions were {perms:?}"
    );
}

#[test]
fn panel_window_has_a_capability_covering_it() {
    let panel = capability("panel");
    assert_eq!(panel["identifier"].as_str(), Some("panel"));
    assert_eq!(windows(&panel), vec!["panel".to_string()]);
}

#[test]
fn panel_may_hide_and_size_itself() {
    let perms = permissions(&capability("panel"));
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
fn panel_gets_no_privileged_plugin_or_destructive_access() {
    let perms = permissions(&capability("panel"));
    // The menu-bar popover is the app's most reachable surface — one click
    // from the menu bar, no window focus needed. It stays a read-and-scan
    // view: no updater, no process control, no file dialogs, no shell
    // opener, and neither of the two destructive commands.
    for prefix in [
        "updater:",
        "process:",
        "dialog:",
        "opener:",
        "notification:",
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
fn every_declared_window_is_covered_by_a_capability() {
    let conf: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tauri.conf.json"))
            .expect("read tauri.conf.json"),
    )
    .expect("parse tauri.conf.json");

    let covered: HashSet<String> = ["default", "panel"]
        .iter()
        .flat_map(|name| windows(&capability(name)))
        .collect();

    for window in conf["app"]["windows"].as_array().expect("windows array") {
        let label = window["label"].as_str().expect("window label");
        assert!(
            covered.contains(label),
            "window `{label}` has no capability, so every IPC call from it is denied"
        );
    }
    // `panel` is created at runtime rather than declared in the config, so
    // the loop above cannot see it; assert it directly.
    assert!(covered.contains("panel"));
}
