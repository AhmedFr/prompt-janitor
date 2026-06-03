//! Prompt Janitor — Tauri application entry point.
//!
//! Phase 0 stands up the window + frontend shell only. The scanner, rules engine,
//! store, scheduler, tray, and AI/fix engine arrive in later phases under their own modules.

/// Build and run the Tauri application.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running the Prompt Janitor application");
}
