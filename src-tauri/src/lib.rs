//! Prompt Janitor — Tauri application entry point.
//!
//! Phase 0 stands up the window, the SQLite store, and typed IPC. The scanner,
//! rules engine, scheduler, tray, and AI/fix engine arrive in later phases.

mod ai;
mod ai_fix;
mod ai_rules;
mod app_data;
mod apply;
mod commands;
pub mod engine;
pub mod harness;
mod harness_query;
mod harness_scan;
mod harness_store;
mod ipc;
pub mod license;
mod notify;
mod panel;
mod panel_query;
mod project_logo;
mod query;
mod repo_root;
pub mod rules;
mod scan;
pub mod scanner;
mod scheduler;
mod store;
pub mod templates;
mod tray;
mod vcs;
mod window_policy;

use std::sync::Mutex;

use tauri::{Manager, WindowEvent};

/// Build and run the Tauri application.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = ipc::ipc_builder();

    // In dev, regenerate the TS bindings on every launch so they never drift.
    #[cfg(debug_assertions)]
    builder
        .export(ipc::ts_exporter(), "../src/lib/bindings.ts")
        .expect("failed to export TypeScript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        // In-app updates: `updater` fetches and installs the signed bundle,
        // `process` relaunches into it once installed.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(builder.invoke_handler())
        .on_window_event(|window, event| {
            let app = window.app_handle();
            match (window.label(), event) {
                // Closing the shell puts the app back in the menu bar; only
                // the tray's Quit and the panel's Quit really exit.
                (window_policy::MAIN_LABEL, WindowEvent::CloseRequested { api, .. }) => {
                    api.prevent_close();
                    window_policy::hide_main(app);
                }
                // A popover that outlives its click is a stuck window.
                (panel::PANEL_LABEL, WindowEvent::Focused(false)) => panel::hide_on_blur(app),
                _ => {}
            }
        })
        .setup(|app| {
            let dir = app.path().app_data_dir().expect("resolve app data dir");
            std::fs::create_dir_all(&dir).ok();
            let db_path = dir.join(app_data::DB_FILE_NAME);
            let conn = store::init_db(&db_path).expect("initialize database");
            app.manage(store::AppDb {
                conn: Mutex::new(conn),
                path: db_path.to_string_lossy().into_owned(),
            });
            scheduler::start(app.handle().clone());
            tray::setup(app)?;
            panel::create(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the Prompt Janitor application");
}
