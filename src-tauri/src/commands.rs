//! Tauri commands exposed to the frontend. Each is `#[specta::specta]` so
//! tauri-specta can generate typed TypeScript bindings.

use std::sync::atomic::{AtomicBool, Ordering};

use crate::query::{self, Overview};
use crate::scan::ScanSummary;
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

/// Set while a scan is running. A scan walks every project and rewrites the
/// database; two overlapping ones interleave their writes and emit two
/// `scan-done` events for what the user asked once.
static SCAN_IN_PROGRESS: AtomicBool = AtomicBool::new(false);

/// Holds the single-flight claim for as long as a scan runs and releases it
/// however that scan ends — including on an early `?`.
struct ScanGuard;

impl ScanGuard {
    /// `None` when a scan is already in flight.
    fn acquire() -> Option<Self> {
        (!SCAN_IN_PROGRESS.swap(true, Ordering::SeqCst)).then_some(Self)
    }
}

impl Drop for ScanGuard {
    fn drop(&mut self) {
        SCAN_IN_PROGRESS.store(false, Ordering::SeqCst);
    }
}

/// Per-file scan progress, emitted on the `scan-progress` event.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct ScanProgress {
    pub done: u32,
    pub total: u32,
}

/// Run a full scan and emit `scan-phase` / `scan-progress` / `scan-done`.
///
/// Two phases: every detected harness is inventoried and its usage indexed,
/// then every rule file is graded — across the harness's project roots, its
/// global layer, and any extra folders the user added by hand. Shared by the
/// `scan_now` command, the tray, and the background scheduler.
///
/// The harness phase runs in three steps so its slowest part holds no lock:
/// `prepare` reads the usage cursors, the guard is dropped while every session
/// log is parsed, and `commit` takes it again to write the pass back. The file
/// phase continues under that same guard.
pub fn scan_and_emit(app: &tauri::AppHandle) -> Result<ScanSummary, String> {
    use tauri::{Emitter, Manager};

    // Before the first event: a refused scan must look like nothing happened,
    // not like a scan that started and never finished.
    let _guard = ScanGuard::acquire().ok_or("A scan is already running.")?;

    let db = app.state::<AppDb>();
    let now_secs = crate::scan::now_epoch().parse::<i64>().unwrap_or(0);
    let harnesses = crate::harness::all();

    let _ = app.emit("scan-phase", "harness");
    let prepared = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        crate::harness_scan::prepare(&conn, &harnesses).map_err(|e| e.to_string())?
    };
    // Unlocked: parsing hundreds of megabytes of session logs must not block
    // every read the UI makes while it runs.
    let indexed = crate::harness_scan::index(&harnesses, prepared);

    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let outcome =
        crate::harness_scan::commit(&conn, &indexed, now_secs).map_err(|e| e.to_string())?;

    let _ = app.emit("scan-phase", "files");

    let mut roots = outcome.roots.clone();
    roots.extend(
        query::extra_scan_folders(&conn)
            .into_iter()
            .map(std::path::PathBuf::from),
    );
    // A hand-picked folder gets the same sieve as a harness project root: a
    // picked `$HOME` (or any parent of a harness home) would sweep the whole
    // disk, and one nested in a root already listed would be walked twice.
    let home_roots: Vec<std::path::PathBuf> = indexed
        .iter()
        .filter(|(p, _)| p.detected)
        .filter_map(|(p, _)| p.home_root.clone())
        .collect();
    let roots = crate::harness_scan::scan_roots(roots, &home_roots);

    let summary = crate::scan::run_scan_all(&conn, &roots, &outcome.extra_files, |done, total| {
        let _ = app.emit("scan-progress", ScanProgress { done, total });
    })
    .map_err(|e| e.to_string())?;

    // Each harness owns its own diagnostics: a single total cannot say which
    // log parser is struggling. Only harnesses that actually ran are listed —
    // an undetected one skipped no lines because it read nothing.
    if let Ok(Some(scan_id)) = crate::harness_store::last_scan_id(&conn) {
        for (harness, skipped) in &outcome.skipped_lines_by_harness {
            let _ = crate::harness_store::record_diagnostics(&conn, scan_id, harness, *skipped);
        }
    }

    let _ = app.emit("scan-done", &summary);
    crate::notify::after_scan(app, &conn);
    Ok(summary)
}

/// Scan everything, grade + persist every prompt file, and return a summary.
/// Emits `scan-phase`, `scan-progress` per file, and `scan-done` at the end.
#[tauri::command]
#[specta::specta]
pub fn scan_now(app: tauri::AppHandle) -> Result<ScanSummary, String> {
    scan_and_emit(&app)
}

/// Fire-and-forget full scan. Used by the tray and the scheduler.
pub fn scan_everything(app: &tauri::AppHandle) {
    let _ = scan_and_emit(app);
}

/// Aggregated data for the Overview screen.
#[tauri::command]
#[specta::specta]
pub fn get_overview(db: tauri::State<'_, AppDb>) -> Result<Overview, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    query::get_overview(&conn).map_err(|e| e.to_string())
}

/// Persist the extra folders to scan on top of the harness's own projects.
#[tauri::command]
#[specta::specta]
pub fn set_extra_scan_folders(
    db: tauri::State<'_, AppDb>,
    folders: Vec<String>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let json = serde_json::to_string(&folders).map_err(|e| e.to_string())?;
    query::set_setting(&conn, "extra_scan_folders", &json).map_err(|e| e.to_string())
}

/// The extra folders currently configured (empty when none).
#[tauri::command]
#[specta::specta]
pub fn get_extra_scan_folders(db: tauri::State<'_, AppDb>) -> Result<Vec<String>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    Ok(query::extra_scan_folders(&conn))
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

/// Add a natural-language custom rule (paid; evaluated by the AI provider).
#[tauri::command]
#[specta::specta]
pub fn add_nl_rule(
    db: tauri::State<'_, AppDb>,
    title: String,
    instruction: String,
    severity: String,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    query::add_nl_rule(&conn, &title, &instruction, &severity)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Evaluate the built-in NL standards (free — needs only a configured
/// provider) plus, for licensed users, the custom NL rules. Persists
/// violations as issues and rescores the file (offer spec §5: the license
/// gates treatment, not diagnosis).
#[tauri::command]
#[specta::specta]
pub async fn evaluate_nl_rules(
    db: tauri::State<'_, AppDb>,
    file_id: String,
) -> Result<crate::ai_rules::NlEvalResult, String> {
    let (creds, content, rules) = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        let detail = query::get_file_detail(&conn, &file_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "File not found".to_string())?;
        let include_custom = entitlement_of(&conn).paid;
        let rules = query::enabled_nl_rules(&conn, include_custom).map_err(|e| e.to_string())?;
        (crate::ai::load_credentials(&conn), detail.content, rules)
    };

    if creds.provider == "none" || creds.key.is_empty() {
        return Err(
            "Connect an AI provider in Settings → AI to evaluate the prompting standards."
                .to_string(),
        );
    }

    let mut verdicts = Vec::new();
    for rule in rules {
        let (violates, explanation) =
            crate::ai_rules::evaluate(&creds, &rule.instruction, &content).await?;
        verdicts.push(crate::ai_rules::NlVerdict {
            rule_id: rule.id,
            title: rule.title,
            severity: rule.severity,
            source: rule.source,
            violates,
            explanation,
        });
    }

    let (score, grade) = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        query::apply_nl_verdicts(&conn, &file_id, &verdicts).map_err(|e| e.to_string())?
    };
    Ok(crate::ai_rules::NlEvalResult {
        verdicts,
        score,
        grade,
    })
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
    set_ai_config_with_conn(&conn, &provider, &api_key, &model)
}

/// The body of [`set_ai_config`], taking a `&Connection` directly rather than
/// a Tauri `State` so it can be exercised in tests.
fn set_ai_config_with_conn(
    conn: &rusqlite::Connection,
    provider: &str,
    api_key: &str,
    model: &str,
) -> Result<(), String> {
    if provider != "none" && !crate::ai::provider::provider_ids().contains(&provider) {
        return Err(format!("Unknown AI provider: {provider}"));
    }
    query::set_setting(conn, "ai_provider", provider).map_err(|e| e.to_string())?;
    if !api_key.is_empty() {
        query::set_setting(conn, "ai_key", api_key).map_err(|e| e.to_string())?;
    }
    query::set_setting(conn, "ai_model", model).map_err(|e| e.to_string())?;
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

/// The paid-tier entitlement derived from the stored license key.
fn entitlement_of(conn: &rusqlite::Connection) -> crate::license::Entitlement {
    let key = query::get_setting(conn, "license_key")
        .ok()
        .flatten()
        .unwrap_or_default();
    match crate::license::verify(&key) {
        Some(info) => crate::license::Entitlement {
            paid: true,
            email: Some(info.email),
            plan: Some(info.plan),
        },
        // Monetisation is paused: every feature is open. A stored key still
        // surfaces its email/plan so nothing is lost when gates return.
        None => crate::license::Entitlement {
            paid: true,
            email: None,
            plan: Some("open".to_string()),
        },
    }
}

const PAID_GATE: &str = "This is a paid feature. Add a license key in Settings → License.";

/// The current entitlement (whether the paid tier is unlocked).
#[tauri::command]
#[specta::specta]
pub fn get_entitlement(db: tauri::State<'_, AppDb>) -> Result<crate::license::Entitlement, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    Ok(entitlement_of(&conn))
}

/// Validate and store a license key. Returns the unlocked plan, or an error if
/// the key isn't valid.
#[tauri::command]
#[specta::specta]
pub fn set_license(
    db: tauri::State<'_, AppDb>,
    key: String,
) -> Result<crate::license::LicenseInfo, String> {
    let info =
        crate::license::verify(&key).ok_or_else(|| "That license key isn't valid.".to_string())?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    query::set_setting(&conn, "license_key", key.trim()).map_err(|e| e.to_string())?;
    Ok(info)
}

/// Remove the stored license, returning to the free tier.
#[tauri::command]
#[specta::specta]
pub fn clear_license(db: tauri::State<'_, AppDb>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    query::set_setting(&conn, "license_key", "").map_err(|e| e.to_string())
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
    let (paid, creds, content, issue) = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        let detail = query::get_file_detail(&conn, &file_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "File not found".to_string())?;
        let issue = detail
            .issues
            .get(issue_index as usize)
            .cloned()
            .ok_or_else(|| "Issue not found".to_string())?;
        (
            entitlement_of(&conn).paid,
            crate::ai::load_credentials(&conn),
            detail.content,
            issue,
        )
    };
    if !paid {
        return Err(PAID_GATE.to_string());
    }
    crate::ai_fix::suggest(&creds, &content, &issue).await
}

/// Seconds since the Unix epoch, as a string — used to stamp backups and to
/// make the git branch name unique.
fn now_stamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
        .to_string()
}

/// Apply one or more fixes to a file (paid): snapshot the prior content into
/// `backups` (for undo), write the new content, and — if `commit` — stage and
/// commit it onto a `prompt-janitor/fix-*` branch. A failed commit rolls the
/// whole operation back so nothing is left half-applied.
#[tauri::command]
#[specta::specta]
pub fn apply_fix(
    db: tauri::State<'_, AppDb>,
    file_id: String,
    edits: Vec<crate::apply::FixEdit>,
    commit: bool,
    origin: String,
) -> Result<crate::apply::ApplyResult, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    apply_fix_with_conn(&conn, &file_id, &edits, commit, &origin)
}

/// The body of [`apply_fix`], taking a `&Connection` directly rather than a
/// Tauri `State` so it can be exercised in tests.
fn apply_fix_with_conn(
    conn: &rusqlite::Connection,
    file_id: &str,
    edits: &[crate::apply::FixEdit],
    commit: bool,
    origin: &str,
) -> Result<crate::apply::ApplyResult, String> {
    if !entitlement_of(conn).paid {
        return Err(PAID_GATE.to_string());
    }

    let path: String = conn
        .query_row("SELECT path FROM files WHERE id = ?1", [file_id], |r| {
            r.get(0)
        })
        .map_err(|e| e.to_string())?;

    let content =
        std::fs::read_to_string(&path).map_err(|e| format!("Couldn't read the file: {e}"))?;
    let updated = crate::apply::apply_edits(&content, edits)?;

    let stamp = now_stamp();
    conn.execute(
        "INSERT INTO backups (file_id, pre_fix_content, applied_at, git_ref) VALUES (?1, ?2, ?3, NULL)",
        rusqlite::params![file_id, &content, &stamp],
    )
    .map_err(|e| e.to_string())?;
    let backup_id = conn.last_insert_rowid();

    std::fs::write(&path, &updated).map_err(|e| format!("Couldn't write the file: {e}"))?;

    let git_ref = if commit {
        match crate::vcs::commit_file(
            std::path::Path::new(&path),
            &stamp,
            &format!("prompt-janitor: fix {file_id}"),
        ) {
            Ok(branch) => {
                conn.execute(
                    "UPDATE backups SET git_ref = ?1 WHERE id = ?2",
                    rusqlite::params![&branch, backup_id],
                )
                .ok();
                Some(branch)
            }
            Err(e) => {
                // Roll back so the opt-in-to-git path is all-or-nothing.
                let _ = std::fs::write(&path, &content);
                let _ = conn.execute("DELETE FROM backups WHERE id = ?1", [backup_id]);
                return Err(format!("Couldn't commit to git: {e}. Nothing was changed."));
            }
        }
    } else {
        None
    };

    // Only recorded once the apply is guaranteed to stick — the git-commit
    // branch above can still roll everything back and return early, in which
    // case we must not log an event for a fix that never actually landed.
    query::record_fix_events(conn, file_id, origin, edits.len()).map_err(|e| e.to_string())?;

    Ok(crate::apply::ApplyResult { git_ref })
}

/// Restore a file to its most recent pre-fix snapshot and drop that snapshot.
#[tauri::command]
#[specta::specta]
pub fn undo_fix(db: tauri::State<'_, AppDb>, file_id: String) -> Result<(), String> {
    use rusqlite::OptionalExtension;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let row = conn
        .query_row(
            "SELECT id, pre_fix_content FROM backups WHERE file_id = ?1 ORDER BY id DESC LIMIT 1",
            [&file_id],
            |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let Some((id, content)) = row else {
        return Err("Nothing to undo for this file.".to_string());
    };

    let path: String = conn
        .query_row("SELECT path FROM files WHERE id = ?1", [&file_id], |r| {
            r.get(0)
        })
        .map_err(|e| e.to_string())?;

    std::fs::write(&path, &content).map_err(|e| format!("Couldn't restore the file: {e}"))?;
    conn.execute("DELETE FROM backups WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Whether a file has a pre-fix snapshot available to undo.
#[tauri::command]
#[specta::specta]
pub fn has_backup(db: tauri::State<'_, AppDb>, file_id: String) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let n: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM backups WHERE file_id = ?1",
            [&file_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(n > 0)
}

/// Every scanned file for the Prompts table.
#[tauri::command]
#[specta::specta]
pub fn list_files(db: tauri::State<'_, AppDb>) -> Result<Vec<query::FileRow>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    query::list_files(&conn).map_err(|e| e.to_string())
}

/// Every project with its rolled-up counts and detected logo.
#[tauri::command]
#[specta::specta]
pub fn list_projects(db: tauri::State<'_, AppDb>) -> Result<Vec<query::ProjectRow>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    query::list_projects(&conn).map_err(|e| e.to_string())
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

/// Everything the Analytics page needs, windowed to the trailing
/// `range_days`.
#[tauri::command]
#[specta::specta]
pub fn get_analytics(
    db: tauri::State<'_, AppDb>,
    range_days: u32,
) -> Result<query::Analytics, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    query::get_analytics(&conn, range_days).map_err(|e| e.to_string())
}

/// The weekly Scans digest.
#[tauri::command]
#[specta::specta]
pub fn get_scans_digest(db: tauri::State<'_, AppDb>) -> Result<query::ScansDigest, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    query::get_scans_digest(&conn).map_err(|e| e.to_string())
}

/// Every starter template pack (#75): free to browse and preview — the
/// one-click write is the paid action, gated in `apply_template`.
#[tauri::command]
#[specta::specta]
pub fn list_templates() -> Vec<crate::templates::TemplateInfo> {
    crate::templates::all()
}

/// Write a starter template into `dest_dir` (paid). Never overwrites an
/// existing same-named file.
#[tauri::command]
#[specta::specta]
pub fn apply_template(
    db: tauri::State<'_, AppDb>,
    template_id: String,
    dest_dir: String,
) -> Result<crate::templates::ApplyTemplateResult, String> {
    let paid = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        entitlement_of(&conn).paid
    };
    if !paid {
        return Err(PAID_GATE.to_string());
    }
    crate::templates::apply(&template_id, &dest_dir)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A freshly migrated in-memory DB with no license key set — i.e. a free,
    /// unentitled user.
    fn free_conn() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        conn
    }

    /// A scan writes the whole database and ends with one `scan-done`; a
    /// second one starting while the first runs would interleave both.
    #[test]
    fn a_second_scan_is_refused_while_one_is_running() {
        let first = ScanGuard::acquire().expect("the first scan takes the claim");
        assert!(
            ScanGuard::acquire().is_none(),
            "a scan starting mid-scan must be turned away"
        );
        drop(first);
        assert!(
            ScanGuard::acquire().is_some(),
            "the claim is released however the scan ends"
        );
    }

    #[test]
    fn apply_fix_is_not_paid_gated_for_a_free_user() {
        // Monetisation is paused: a free/unentitled user is never turned away
        // by the paid gate. This DB row points at a file that doesn't exist
        // on disk, so the call still fails — just not with PAID_GATE.
        let conn = free_conn();
        conn.execute(
            "INSERT INTO projects(id, name, root_path) VALUES('p', 'P', '/p')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files(id, project_id, path, kind) VALUES('f', 'p', '/p/f.md', 'md')",
            [],
        )
        .unwrap();

        let edits = vec![crate::apply::FixEdit {
            from: "x".to_string(),
            to: "y".to_string(),
        }];
        let result = apply_fix_with_conn(&conn, "f", &edits, false, "manual");

        assert!(result.unwrap_err().contains("Couldn't read the file"));
    }

    #[test]
    fn set_ai_config_rejects_an_unknown_provider() {
        let conn = free_conn();
        let result = set_ai_config_with_conn(&conn, "not-a-real-provider", "", "");
        assert_eq!(
            result.unwrap_err(),
            "Unknown AI provider: not-a-real-provider"
        );
    }

    #[test]
    fn set_ai_config_allows_none_and_registered_providers() {
        let conn = free_conn();
        assert!(set_ai_config_with_conn(&conn, "none", "", "").is_ok());
        for id in crate::ai::provider::provider_ids() {
            assert!(set_ai_config_with_conn(&conn, id, "", "").is_ok());
        }
    }

    #[test]
    fn entitlement_is_open_without_a_license() {
        let conn = free_conn();
        let ent = entitlement_of(&conn);
        assert!(ent.paid);
        assert_eq!(ent.plan.as_deref(), Some("open"));
        assert!(ent.email.is_none());
    }
}

// ---------------------------------------------------------------------------
// Harness setup + usage (read models in `harness_query`)
// ---------------------------------------------------------------------------

/// Everything the Setup screen renders: harnesses, the global layer, and each
/// project with its own artifacts.
#[tauri::command]
#[specta::specta]
pub fn get_setup(db: tauri::State<'_, AppDb>) -> Result<crate::harness_query::SetupView, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    crate::harness_query::setup_view(&conn).map_err(|e| e.to_string())
}

/// The rule files `harness` loads inside `project_path`, in load order.
#[tauri::command]
#[specta::specta]
pub fn get_effective_rules(
    db: tauri::State<'_, AppDb>,
    harness: String,
    project_path: String,
) -> Result<Vec<crate::harness_query::EffectiveRule>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    crate::harness_query::effective_rules(&conn, &harness, &project_path).map_err(|e| e.to_string())
}

/// Usage aggregates for the Analytics screen over the last `window_days`,
/// anchored to the current clock.
#[tauri::command]
#[specta::specta]
pub fn get_usage_overview(
    db: tauri::State<'_, AppDb>,
    window_days: u32,
) -> Result<crate::harness_query::UsageOverview, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = crate::scan::now_epoch().parse::<i64>().unwrap_or(0);
    crate::harness_query::usage_overview(&conn, now, window_days).map_err(|e| e.to_string())
}

/// One project's usage over the last `window_days`, anchored to the current
/// clock: what `harness` invoked there, and how often it was worked in.
/// `window_days` is capped at a year — the daily series has a point per day.
#[tauri::command]
#[specta::specta]
pub fn get_project_usage(
    db: tauri::State<'_, AppDb>,
    harness: String,
    project_path: String,
    window_days: u32,
) -> Result<crate::harness_query::ProjectUsage, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = crate::scan::now_epoch().parse::<i64>().unwrap_or(0);
    crate::harness_query::project_usage(&conn, &harness, &project_path, now, window_days)
        .map_err(|e| e.to_string())
}

/// Every harness we know of, detected or not.
#[tauri::command]
#[specta::specta]
pub fn list_harnesses(
    db: tauri::State<'_, AppDb>,
) -> Result<Vec<crate::harness_query::HarnessInfo>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    crate::harness_query::list_harnesses(&conn).map_err(|e| e.to_string())
}
