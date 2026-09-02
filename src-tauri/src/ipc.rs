//! Typed IPC wiring. The Builder is the single source of truth for both the
//! Tauri invoke handler and the generated TypeScript bindings.

use specta_typescript::Typescript;
use tauri_specta::{collect_commands, Builder};

/// Build the tauri-specta command registry.
pub fn ipc_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new()
        .commands(collect_commands![
            crate::commands::get_app_status,
            crate::commands::ping,
            crate::commands::scan_now,
            crate::commands::get_overview,
            crate::commands::set_extra_scan_folders,
            crate::commands::get_extra_scan_folders,
            crate::commands::set_schedule,
            crate::commands::get_schedule,
            crate::commands::set_alert,
            crate::commands::get_alert,
            crate::commands::set_pack,
            crate::commands::get_pack,
            crate::commands::list_rules,
            crate::commands::set_rule,
            crate::commands::add_custom_rule,
            crate::commands::add_nl_rule,
            crate::commands::evaluate_nl_rules,
            crate::commands::delete_custom_rule,
            crate::commands::import_pack,
            crate::commands::set_ai_config,
            crate::commands::get_ai_config,
            crate::commands::test_ai_connection,
            crate::commands::get_entitlement,
            crate::commands::set_license,
            crate::commands::clear_license,
            crate::commands::suggest_fix,
            crate::commands::apply_fix,
            crate::commands::undo_fix,
            crate::commands::has_backup,
            crate::commands::list_files,
            crate::commands::list_projects,
            crate::commands::get_file_detail,
            crate::commands::get_analytics,
            crate::commands::get_scans_digest,
            crate::commands::list_templates,
            crate::commands::apply_template,
            crate::commands::get_setup,
            crate::commands::get_effective_rules,
            crate::commands::get_usage_overview,
            crate::commands::get_project_usage,
            crate::commands::list_harnesses,
            crate::commands::get_panel_snapshot,
            crate::commands::open_main,
            crate::commands::quit,
            crate::app_data::reset_app_data,
            crate::app_data::uninstall_app,
        ])
        // Event payloads appear in no command signature; register the type so the
        // frontend listener is typed from the same source as the commands.
        .typ::<crate::commands::NavigateEvent>()
}

/// Shared TS exporter config (single place to tune formatting later).
pub fn ts_exporter() -> Typescript {
    Typescript::default()
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeSet;

    /// `build.rs` registers `command_names::COMMANDS` with the ACL; the invoke
    /// handler registers whatever `collect_commands!` lists. The two are
    /// hand-maintained, and a command present in only one of them compiles,
    /// passes every other test, and then fails at runtime as an ACL denial.
    /// The builder exposes no accessor for its commands, so this reads them
    /// back from the TypeScript it exports: every `__TAURI_INVOKE("name"` —
    /// with an optional `<Type>` between the two for infallible commands.
    #[test]
    fn the_acl_command_list_matches_what_the_invoke_handler_registers() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("bindings.ts");
        super::ipc_builder()
            .export(super::ts_exporter(), &path)
            .expect("export bindings");
        let ts = std::fs::read_to_string(&path).unwrap();

        const CALL: &str = "__TAURI_INVOKE";
        const OPEN: &str = "(\"";
        let registered: BTreeSet<&str> = ts
            .match_indices(CALL)
            .map(|(at, _)| {
                let rest = &ts[at + CALL.len()..];
                let rest = &rest[rest.find(OPEN).expect("opening quote") + OPEN.len()..];
                &rest[..rest.find('"').expect("closing quote")]
            })
            .collect();
        let listed: BTreeSet<&str> = crate::command_names::COMMANDS.iter().copied().collect();

        assert_eq!(
            registered, listed,
            "command_names::COMMANDS and collect_commands! in ipc.rs have drifted"
        );
    }

    /// Regenerates `src/lib/bindings.ts` headlessly (run via `cargo test`).
    /// Keeps the frontend types in lockstep with the Rust commands without
    /// needing to launch the GUI.
    #[test]
    fn export_typescript_bindings() {
        super::ipc_builder()
            .export(super::ts_exporter(), "../src/lib/bindings.ts")
            .expect("failed to export TypeScript bindings");
    }
}
