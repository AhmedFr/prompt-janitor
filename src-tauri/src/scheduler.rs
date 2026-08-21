//! Background scheduler: periodic scans (1h/6h/1d) + on-save watch-mode.
//!
//! A single tick loop reads the current schedule each tick and runs a full
//! scan (every detected harness + the user's extra folders) when due. One
//! `notify` watcher, re-pointed when the extra folders change, flips a `dirty`
//! flag for on-save mode. `manual` never auto-scans.

use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use notify::{RecursiveMode, Watcher};
use tauri::{AppHandle, Manager};

use crate::query::{get_setting, set_setting};
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

/// The schedule actually in force this tick.
///
/// On-save mode is driven by a filesystem watcher, and only the user's extra
/// folders are watched. With none configured no event can ever arrive, so
/// "on save" would silently mean "never" — fall back to the 6h default so a
/// harness-only setup still gets refreshed.
fn effective_schedule(schedule: &str, watch_roots_empty: bool) -> Schedule {
    match parse_schedule(schedule) {
        Schedule::OnSave if watch_roots_empty => parse_schedule("6h"),
        other => other,
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
        let mut watched: Vec<String> = Vec::new();
        let mut change_at = 0u64;

        loop {
            tokio::time::sleep(TICK).await;

            let db = app.state::<AppDb>();
            let (schedule_str, watch_roots, last_scan, notify_digest, last_digest) = {
                let Ok(conn) = db.conn.lock() else {
                    continue;
                };
                let schedule = get_setting(&conn, "schedule")
                    .ok()
                    .flatten()
                    .unwrap_or_else(|| "6h".to_string());
                let watch_roots = crate::query::extra_scan_folders(&conn);
                let last = conn
                    .query_row("SELECT MAX(finished_at) FROM scans", [], |r| {
                        r.get::<_, Option<String>>(0)
                    })
                    .ok()
                    .flatten()
                    .and_then(|s| s.parse::<u64>().ok())
                    .unwrap_or(0);
                let notify_digest = get_setting(&conn, "notify_digest")
                    .ok()
                    .flatten()
                    .as_deref()
                    != Some("false");
                let last_digest = get_setting(&conn, "last_digest")
                    .ok()
                    .flatten()
                    .and_then(|s| s.parse::<u64>().ok())
                    .unwrap_or(0);
                (schedule, watch_roots, last, notify_digest, last_digest)
            };

            // Re-point the watcher when the extra folders change. Only those
            // are watched: harness project roots come and go on their own and
            // are covered by the interval schedules.
            if watched != watch_roots {
                if let Some(w) = watcher.as_mut() {
                    for old in &watched {
                        let _ = w.unwatch(Path::new(old));
                    }
                    for root in &watch_roots {
                        let _ = w.watch(Path::new(root), RecursiveMode::Recursive);
                    }
                }
                watched = watch_roots;
                dirty.store(false, Ordering::Relaxed);
                change_at = 0;
            }

            if dirty.load(Ordering::Relaxed) && change_at == 0 {
                change_at = now_secs();
            }

            let due = match effective_schedule(&schedule_str, watched.is_empty()) {
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
                crate::commands::scan_everything(&app);
            }

            // Weekly digest notification.
            const WEEK: u64 = 7 * 24 * 3600;
            if last_digest == 0 {
                if let Ok(conn) = db.conn.lock() {
                    let _ = set_setting(&conn, "last_digest", &now_secs().to_string());
                }
            } else if notify_digest && now_secs().saturating_sub(last_digest) >= WEEK {
                let digest = match db.conn.lock() {
                    Ok(conn) => crate::query::get_scans_digest(&conn).ok(),
                    Err(_) => None,
                };
                if let Some(d) = digest {
                    crate::notify::send(
                        &app,
                        "Your weekly prompt digest",
                        &crate::notify::digest_summary(&d),
                    );
                    if let Ok(conn) = db.conn.lock() {
                        let _ = set_setting(&conn, "last_digest", &now_secs().to_string());
                    }
                }
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

    #[test]
    fn on_save_without_watch_roots_falls_back_to_periodic() {
        // Nothing is watched (no extra folders), so no file event will ever
        // arrive — on-save would mean "never scan again".
        assert_eq!(effective_schedule("save", true), parse_schedule("6h"));
        // With something watched, on-save is honoured.
        assert_eq!(effective_schedule("save", false), Schedule::OnSave);
        // Every other schedule is unaffected by the watch set.
        assert_eq!(effective_schedule("1h", true), parse_schedule("1h"));
        assert_eq!(effective_schedule("manual", true), Schedule::Manual);
    }
}
