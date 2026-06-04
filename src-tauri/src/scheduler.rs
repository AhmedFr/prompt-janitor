//! Background scheduler: periodic scans (1h/6h/1d) + on-save watch-mode.
//!
//! A single tick loop reads the current schedule + folder each tick and scans
//! when due. One `notify` watcher (re-pointed when the folder changes) flips a
//! `dirty` flag for on-save mode. `manual` never auto-scans.

use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use notify::{RecursiveMode, Watcher};
use tauri::{AppHandle, Manager};

use crate::query::get_setting;
use crate::store::AppDb;

const TICK: Duration = Duration::from_secs(15);
const SAVE_DEBOUNCE_SECS: u64 = 2;

/// A parsed scan schedule.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Schedule {
    Interval(Duration),
    OnSave,
    Manual,
}

/// Parse a stored schedule value. Unknown values fall back to `Manual`.
pub fn parse_schedule(value: &str) -> Schedule {
    match value {
        "1h" => Schedule::Interval(Duration::from_secs(3600)),
        "6h" => Schedule::Interval(Duration::from_secs(6 * 3600)),
        "1d" => Schedule::Interval(Duration::from_secs(24 * 3600)),
        "save" => Schedule::OnSave,
        _ => Schedule::Manual,
    }
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Spawn the background scheduler loop. Call once at startup.
pub fn start(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let dirty = Arc::new(AtomicBool::new(false));
        let mut watcher = {
            let dirty = dirty.clone();
            notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
                if res.is_ok() {
                    dirty.store(true, Ordering::Relaxed);
                }
            })
            .ok()
        };
        let mut watched: Option<String> = None;
        let mut change_at = 0u64;

        loop {
            tokio::time::sleep(TICK).await;

            let db = app.state::<AppDb>();
            let (schedule_str, folder, last_scan) = {
                let Ok(conn) = db.conn.lock() else {
                    continue;
                };
                let schedule = get_setting(&conn, "schedule")
                    .ok()
                    .flatten()
                    .unwrap_or_else(|| "6h".to_string());
                let folder = get_setting(&conn, "scan_folder").ok().flatten();
                let last = conn
                    .query_row("SELECT MAX(finished_at) FROM scans", [], |r| {
                        r.get::<_, Option<String>>(0)
                    })
                    .ok()
                    .flatten()
                    .and_then(|s| s.parse::<u64>().ok())
                    .unwrap_or(0);
                (schedule, folder, last)
            };

            let Some(folder) = folder else {
                continue; // nothing configured to scan
            };

            // Re-point the watcher when the folder changes.
            if watched.as_deref() != Some(folder.as_str()) {
                if let Some(w) = watcher.as_mut() {
                    if let Some(old) = &watched {
                        let _ = w.unwatch(Path::new(old));
                    }
                    let _ = w.watch(Path::new(&folder), RecursiveMode::Recursive);
                }
                watched = Some(folder.clone());
                dirty.store(false, Ordering::Relaxed);
                change_at = 0;
            }

            if dirty.load(Ordering::Relaxed) && change_at == 0 {
                change_at = now_secs();
            }

            let due = match parse_schedule(&schedule_str) {
                Schedule::Manual => false,
                Schedule::Interval(d) => now_secs().saturating_sub(last_scan) >= d.as_secs(),
                Schedule::OnSave => {
                    dirty.load(Ordering::Relaxed)
                        && now_secs().saturating_sub(change_at) >= SAVE_DEBOUNCE_SECS
                }
            };

            if due {
                dirty.store(false, Ordering::Relaxed);
                change_at = 0;
                let _ = crate::commands::scan_and_emit(&app, &std::path::PathBuf::from(&folder));
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_known_schedules() {
        assert_eq!(
            parse_schedule("1h"),
            Schedule::Interval(Duration::from_secs(3600))
        );
        assert_eq!(
            parse_schedule("6h"),
            Schedule::Interval(Duration::from_secs(21600))
        );
        assert_eq!(
            parse_schedule("1d"),
            Schedule::Interval(Duration::from_secs(86400))
        );
        assert_eq!(parse_schedule("save"), Schedule::OnSave);
        assert_eq!(parse_schedule("manual"), Schedule::Manual);
        assert_eq!(parse_schedule("nonsense"), Schedule::Manual);
    }
}
