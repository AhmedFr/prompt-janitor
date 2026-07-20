//! Prompt Janitor — Tauri application entry point.
//!
//! Phase 0 stands up the window, the SQLite store, and typed IPC. The scanner,
//! rules engine, scheduler, tray, and AI/fix engine arrive in later phases.

mod ai;
mod ai_fix;
mod ai_rules;
mod apply;
mod commands;
pub mod engine;
mod ipc;
pub mod license;
mod notify;
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

use std::sync::Mutex;

use tauri::Manager;

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
        .invoke_handler(builder.invoke_handler())
        .setup(|app| {
            let dir = app.path().app_data_dir().expect("resolve app data dir");
            std::fs::create_dir_all(&dir).ok();
            let db_path = dir.join("prompt-janitor.db");
            let conn = store::open_and_migrate(&db_path).expect("initialize database");
            query::seed_rules(&conn).ok();
            query::seed_builtin_nl_rules(&conn).ok();
            app.manage(store::AppDb {
                conn: Mutex::new(conn),
                path: db_path.to_string_lossy().into_owned(),
            });
            scheduler::start(app.handle().clone());
            tray::setup(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the Prompt Janitor application");
}
