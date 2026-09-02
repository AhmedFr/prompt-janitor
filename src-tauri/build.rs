//! Build script: registers the app's own commands with Tauri's ACL.
//!
//! Without an app manifest, Tauri treats every `#[tauri::command]` as
//! allowed for every window — so the tray panel could reset or uninstall the
//! app and the capabilities under `capabilities/` only ever governed plugin
//! commands. Listing the commands here turns each into an
//! `allow-<command>` / `deny-<command>` permission that a capability has to
//! grant explicitly, per window. `tauri-build` fails the build when a
//! capability names a permission that does not exist, so a typo in either
//! place is caught at compile time rather than as a silent denial at runtime.
//!
//! The list must match `collect_commands!` in `src/ipc.rs` (snake_case). A
//! command missing here is denied for every window.
//!
//! The webview's Content-Security-Policy lives in `tauri.conf.json`, where
//! comments are not allowed, so its rationale is kept here:
//!
//! - `default-src 'self'` / `script-src 'self'`: only the bundled assets run.
//!   Tauri adds a nonce or hash for the scripts it injects when a CSP is set,
//!   so `'unsafe-inline'` is not needed for scripts in production.
//! - `style-src 'unsafe-inline'`: React and Recharts set inline `style`
//!   attributes; there is no way to nonce those.
//! - `img-src data:`: project logos are built in Rust as `data:` URIs and
//!   rendered by `<img>` (`src/components/ProjectGlyph`).
//! - `font-src 'self'`: no external fonts are loaded.
//! - `connect-src ipc: http://ipc.localhost`: the IPC transport on macOS
//!   (custom scheme) and elsewhere (localhost origin).
//! - `object-src`, `base-uri`, `frame-ancestors` all `'none'`: nothing
//!   embeds, rebases or frames the app.
//! - `devCsp` additionally allows `script-src 'unsafe-inline'` for the Vite
//!   React-refresh preamble and `connect-src` to the dev server and its HMR
//!   websocket on port 1420.

fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "get_app_status",
            "ping",
            "scan_now",
            "get_overview",
            "set_extra_scan_folders",
            "get_extra_scan_folders",
            "set_schedule",
            "get_schedule",
            "set_alert",
            "get_alert",
            "set_pack",
            "get_pack",
            "list_rules",
            "set_rule",
            "add_custom_rule",
            "add_nl_rule",
            "evaluate_nl_rules",
            "delete_custom_rule",
            "import_pack",
            "set_ai_config",
            "get_ai_config",
            "test_ai_connection",
            "get_entitlement",
            "set_license",
            "clear_license",
            "suggest_fix",
            "apply_fix",
            "undo_fix",
            "has_backup",
            "list_files",
            "list_projects",
            "get_file_detail",
            "get_analytics",
            "get_scans_digest",
            "list_templates",
            "apply_template",
            "get_setup",
            "get_effective_rules",
            "get_usage_overview",
            "get_project_usage",
            "list_harnesses",
            "get_panel_snapshot",
            "open_main",
            "quit",
            "reset_app_data",
            "uninstall_app",
        ]),
    ))
    .expect("failed to run tauri-build");
}
