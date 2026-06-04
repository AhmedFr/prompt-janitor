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

/// Enable/disable a built-in rule pack ("anthropic", "openai", "karpathy").
/// Toggles every rule of that source — affects grading on the next scan.
#[tauri::command]
#[specta::specta]
pub fn set_pack(db: tauri::State<'_, AppDb>, id: String, enabled: bool) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    query::set_pack(&conn, &id, enabled).map_err(|e| e.to_string())
}

/// Whether every rule of a pack is enabled (defaults to on).
#[tauri::command]
#[specta::specta]
pub fn get_pack(db: tauri::State<'_, AppDb>, id: String) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    query::pack_enabled(&conn, &id).map_err(|e| e.to_string())
}

/// The built-in rules with their enabled state.
#[tauri::command]
#[specta::specta]
pub fn list_rules(db: tauri::State<'_, AppDb>) -> Result<Vec<query::RuleInfo>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    query::list_rules(&conn).map_err(|e| e.to_string())
}

/// Enable/disable a single rule.
#[tauri::command]
#[specta::specta]
pub fn set_rule(db: tauri::State<'_, AppDb>, id: String, enabled: bool) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    query::set_rule(&conn, &id, enabled).map_err(|e| e.to_string())
}

/// Add a custom pattern rule (forbidden substring) with a severity.
#[tauri::command]
#[specta::specta]
pub fn add_custom_rule(
    db: tauri::State<'_, AppDb>,
    title: String,
    pattern: String,
    severity: String,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    query::add_custom_rule(&conn, &title, &pattern, &severity)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Delete a custom rule.
#[tauri::command]
#[specta::specta]
pub fn delete_custom_rule(db: tauri::State<'_, AppDb>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    query::delete_custom_rule(&conn, &id).map_err(|e| e.to_string())
}

/// A rule definition inside an imported pack file.
#[derive(serde::Deserialize)]
struct PackRule {
    title: String,
    pattern: String,
    severity: String,
}

/// Import a JSON pack file — an array of `{title, pattern, severity}` — as
/// custom rules. Returns how many were imported.
#[tauri::command]
#[specta::specta]
pub fn import_pack(db: tauri::State<'_, AppDb>, path: String) -> Result<u32, String> {
    let content =
        std::fs::read_to_string(&path).map_err(|e| format!("Couldn't read the file: {e}"))?;
    let rules: Vec<PackRule> =
        serde_json::from_str(&content).map_err(|e| format!("Invalid pack JSON: {e}"))?;

    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut imported = 0u32;
    for rule in &rules {
        let severity = match rule.severity.as_str() {
            "hi" | "mid" | "lo" => rule.severity.as_str(),
            _ => "mid",
        };
        query::add_custom_rule(&conn, &rule.title, &rule.pattern, severity)
            .map_err(|e| e.to_string())?;
        imported += 1;
    }
    Ok(imported)
}

/// Save the AI provider config. An empty `api_key` keeps the stored one.
#[tauri::command]
#[specta::specta]
pub fn set_ai_config(
    db: tauri::State<'_, AppDb>,
    provider: String,
    api_key: String,
    model: String,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    query::set_setting(&conn, "ai_provider", &provider).map_err(|e| e.to_string())?;
    if !api_key.is_empty() {
        query::set_setting(&conn, "ai_key", &api_key).map_err(|e| e.to_string())?;
    }
    query::set_setting(&conn, "ai_model", &model).map_err(|e| e.to_string())?;
    Ok(())
}

/// The current AI config (without the key).
#[tauri::command]
#[specta::specta]
pub fn get_ai_config(db: tauri::State<'_, AppDb>) -> Result<crate::ai::AiConfig, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    Ok(crate::ai::config_view(&conn))
}

/// Verify the configured provider + key with a tiny request.
#[tauri::command]
#[specta::specta]
pub async fn test_ai_connection(db: tauri::State<'_, AppDb>) -> Result<String, String> {
    let creds = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        crate::ai::load_credentials(&conn)
    };
    crate::ai::complete(
        &creds,
        "You are a connectivity test.",
        "Reply with the single word OK.",
    )
    .await
    .map(|_| "Connected".to_string())
}

/// Generate an AI rewrite for one issue of a file (paid). Returns a `from → to`
/// diff via the configured provider, replacing the static suggested fix.
#[tauri::command]
#[specta::specta]
pub async fn suggest_fix(
    db: tauri::State<'_, AppDb>,
    file_id: String,
    issue_index: u32,
) -> Result<crate::ai_fix::FixSuggestion, String> {
    let (creds, content, issue) = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        let detail = query::get_file_detail(&conn, &file_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "File not found".to_string())?;
        let issue = detail
            .issues
            .get(issue_index as usize)
            .cloned()
            .ok_or_else(|| "Issue not found".to_string())?;
        (crate::ai::load_credentials(&conn), detail.content, issue)
    };
    crate::ai_fix::suggest(&creds, &content, &issue).await
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
