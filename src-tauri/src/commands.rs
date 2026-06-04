//! Tauri commands exposed to the frontend. Each is `#[specta::specta]` so
//! tauri-specta can generate typed TypeScript bindings.

use crate::query::{self, Overview};
use crate::scan::{run_scan, ScanSummary};
use crate::store::AppDb;

/// A small status payload proving the typed store ↔ frontend round-trip.
///
/// Fields are `i32` so specta exports them as TS `number` (specta refuses to
/// export 64-bit ints by default; our counts/versions are tiny).
#[derive(serde::Serialize, specta::Type)]
pub struct AppStatus {
    pub schema_version: i32,
    pub db_path: String,
    pub project_count: i32,
    pub file_count: i32,
}

/// Health/status of the local database.
#[tauri::command]
#[specta::specta]
pub fn get_app_status(db: tauri::State<'_, AppDb>) -> Result<AppStatus, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let schema_version: i64 = conn
        .query_row("PRAGMA user_version", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let project_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM projects", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let file_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM files", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    Ok(AppStatus {
        schema_version: schema_version as i32,
        db_path: db.path.clone(),
        project_count: project_count as i32,
        file_count: file_count as i32,
    })
}

/// Liveness check.
#[tauri::command]
#[specta::specta]
pub fn ping() -> String {
    "pong".to_string()
}

/// Per-file scan progress, emitted on the `scan-progress` event.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct ScanProgress {
    pub done: u32,
    pub total: u32,
}

/// Scan `path`, grade + persist every prompt file, and return a summary.
/// Emits `scan-progress` per file and `scan-done` at the end.
#[tauri::command]
#[specta::specta]
pub fn scan_now(
    app: tauri::AppHandle,
    db: tauri::State<'_, AppDb>,
    path: String,
) -> Result<ScanSummary, String> {
    use tauri::Emitter;

    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let root = std::path::PathBuf::from(&path);
    let summary = run_scan(&conn, &root, |done, total| {
        let _ = app.emit("scan-progress", ScanProgress { done, total });
    })
    .map_err(|e| e.to_string())?;
    let _ = app.emit("scan-done", &summary);
    Ok(summary)
}

/// Aggregated data for the Overview screen.
#[tauri::command]
#[specta::specta]
pub fn get_overview(db: tauri::State<'_, AppDb>) -> Result<Overview, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    query::get_overview(&conn).map_err(|e| e.to_string())
}

/// Persist the folder to scan.
#[tauri::command]
#[specta::specta]
pub fn set_scan_folder(db: tauri::State<'_, AppDb>, path: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    query::set_setting(&conn, "scan_folder", &path).map_err(|e| e.to_string())
}

/// The currently configured scan folder, if any.
#[tauri::command]
#[specta::specta]
pub fn get_scan_folder(db: tauri::State<'_, AppDb>) -> Result<Option<String>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    query::get_setting(&conn, "scan_folder").map_err(|e| e.to_string())
}

/// Every scanned file for the Prompts table.
#[tauri::command]
#[specta::specta]
pub fn list_files(db: tauri::State<'_, AppDb>) -> Result<Vec<query::FileRow>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    query::list_files(&conn).map_err(|e| e.to_string())
}
