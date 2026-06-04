//! Prompt Janitor — Tauri application entry point.
//!
//! Phase 0 stands up the window, the SQLite store, and typed IPC. The scanner,
//! rules engine, scheduler, tray, and AI/fix engine arrive in later phases.

mod commands;
pub mod engine;
mod ipc;
pub mod rules;
pub mod scanner;
mod store;

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
        .invoke_handler(builder.invoke_handler())
        .setup(|app| {
            let dir = app.path().app_data_dir().expect("resolve app data dir");
            std::fs::create_dir_all(&dir).ok();
            let db_path = dir.join("prompt-janitor.db");
            let conn = store::open_and_migrate(&db_path).expect("initialize database");
            app.manage(store::AppDb {
                conn: Mutex::new(conn),
                path: db_path.to_string_lossy().into_owned(),
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the Prompt Janitor application");
}
