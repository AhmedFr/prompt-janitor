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

/// Run a scan of `root`, persist results, and emit `scan-progress`/`scan-done`.
/// Shared by the `scan_now` command and the background scheduler.
pub fn scan_and_emit(
    app: &tauri::AppHandle,
    root: &std::path::Path,
) -> Result<ScanSummary, String> {
    use tauri::{Emitter, Manager};

    let db = app.state::<AppDb>();
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let summary = run_scan(&conn, root, |done, total| {
        let _ = app.emit("scan-progress", ScanProgress { done, total });
    })
    .map_err(|e| e.to_string())?;
    let _ = app.emit("scan-done", &summary);
    crate::notify::after_scan(app, &conn);
    Ok(summary)
}

/// Scan `path`, grade + persist every prompt file, and return a summary.
/// Emits `scan-progress` per file and `scan-done` at the end.
#[tauri::command]
#[specta::specta]
pub fn scan_now(app: tauri::AppHandle, path: String) -> Result<ScanSummary, String> {
    scan_and_emit(&app, &std::path::PathBuf::from(&path))
}

/// Scan the currently configured folder, if any. Used by the tray.
pub fn scan_configured_folder(app: &tauri::AppHandle) {
    use tauri::Manager;
    let folder = {
        let db = app.state::<AppDb>();
        let Ok(conn) = db.conn.lock() else {
            return;
        };
        query::get_setting(&conn, "scan_folder").ok().flatten()
    };
    if let Some(folder) = folder {
        let _ = scan_and_emit(app, &std::path::PathBuf::from(folder));
    }
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

/// Persist the scan schedule ("1h", "6h", "1d", "save", or "manual").
#[tauri::command]
#[specta::specta]
pub fn set_schedule(db: tauri::State<'_, AppDb>, value: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    query::set_setting(&conn, "schedule", &value).map_err(|e| e.to_string())
}

/// The current scan schedule (defaults to "6h").
#[tauri::command]
#[specta::specta]
pub fn get_schedule(db: tauri::State<'_, AppDb>) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    Ok(query::get_setting(&conn, "schedule")
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| "6h".to_string()))
}

/// Toggle an alert ("regressions" or "digest").
#[tauri::command]
#[specta::specta]
pub fn set_alert(db: tauri::State<'_, AppDb>, key: String, enabled: bool) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let value = if enabled { "true" } else { "false" };
    query::set_setting(&conn, &format!("notify_{key}"), value).map_err(|e| e.to_string())
}

/// Whether an alert is on (defaults to on).
#[tauri::command]
#[specta::specta]
pub fn get_alert(db: tauri::State<'_, AppDb>, key: String) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let value = query::get_setting(&conn, &format!("notify_{key}")).map_err(|e| e.to_string())?;
    Ok(value.as_deref() != Some("false"))
}

/// Enable/disable a built-in rule pack ("anthropic", "openai", "karpathy", …).
/// Phase 3 reads `pack_<id>` when grading.
#[tauri::command]
#[specta::specta]
pub fn set_pack(db: tauri::State<'_, AppDb>, id: String, enabled: bool) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let value = if enabled { "true" } else { "false" };
    query::set_setting(&conn, &format!("pack_{id}"), value).map_err(|e| e.to_string())
}

/// Whether a rule pack is enabled (defaults to on).
#[tauri::command]
#[specta::specta]
pub fn get_pack(db: tauri::State<'_, AppDb>, id: String) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let value = query::get_setting(&conn, &format!("pack_{id}")).map_err(|e| e.to_string())?;
    Ok(value.as_deref() != Some("false"))
}

/// Every scanned file for the Prompts table.
#[tauri::command]
#[specta::specta]
pub fn list_files(db: tauri::State<'_, AppDb>) -> Result<Vec<query::FileRow>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    query::list_files(&conn).map_err(|e| e.to_string())
}

/// One file's source + issues for the Detail screen.
#[tauri::command]
#[specta::specta]
pub fn get_file_detail(
    db: tauri::State<'_, AppDb>,
    file_id: String,
) -> Result<Option<query::FileDetail>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    query::get_file_detail(&conn, &file_id).map_err(|e| e.to_string())
}

/// The weekly Scans digest.
#[tauri::command]
#[specta::specta]
pub fn get_scans_digest(db: tauri::State<'_, AppDb>) -> Result<query::ScansDigest, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    query::get_scans_digest(&conn).map_err(|e| e.to_string())
}
