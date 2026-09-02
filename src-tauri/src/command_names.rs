// The one list of app command names.
//
// Read by two places that cannot share code any other way: `build.rs`
// `include!`s this file to register the commands with Tauri's ACL (it runs
// before the crate exists, so it cannot `use` anything from it), and a test
// in `ipc.rs` checks it against what `collect_commands!` actually
// registered. A command added to one side but not the other therefore fails
// `cargo test` rather than surfacing as an ACL denial at runtime.
//
// Keep it in the same order as `collect_commands!` in `ipc.rs`, snake_case.
// This file must stay `include!`-able: only this constant, no `use`, and
// plain `//` comments rather than `//!` module docs (which `include!` at
// item position rejects).

/// Every `#[tauri::command]` the app registers, in `collect_commands!` order.
pub const COMMANDS: &[&str] = &[
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
];
