//! Typed IPC wiring. The Builder is the single source of truth for both the
//! Tauri invoke handler and the generated TypeScript bindings.

use specta_typescript::Typescript;
use tauri_specta::{collect_commands, Builder};

/// Build the tauri-specta command registry.
pub fn ipc_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new().commands(collect_commands![
        crate::commands::get_app_status,
        crate::commands::ping,
        crate::commands::scan_now,
        crate::commands::get_overview,
        crate::commands::set_scan_folder,
        crate::commands::get_scan_folder,
        crate::commands::set_schedule,
        crate::commands::get_schedule,
        crate::commands::set_alert,
        crate::commands::get_alert,
        crate::commands::set_pack,
        crate::commands::get_pack,
        crate::commands::list_rules,
        crate::commands::set_rule,
        crate::commands::add_custom_rule,
        crate::commands::delete_custom_rule,
        crate::commands::list_files,
        crate::commands::get_file_detail,
        crate::commands::get_scans_digest,
    ])
}

/// Shared TS exporter config (single place to tune formatting later).
pub fn ts_exporter() -> Typescript {
    Typescript::default()
}

#[cfg(test)]
mod tests {
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
