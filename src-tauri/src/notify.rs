//! Native OS notifications: regression alerts (after a scan) + the weekly digest.

use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

use crate::query::{get_scans_digest, get_setting, ScansDigest};

/// A `notify_<key>` setting is on unless explicitly set to "false".
fn enabled(conn: &rusqlite::Connection, key: &str) -> bool {
    get_setting(conn, key).ok().flatten().as_deref() != Some("false")
}

/// The notification body for a regression, if any file dropped a grade.
pub fn regression_message(digest: &ScansDigest) -> Option<String> {
    if digest.regressed == 0 {
        return None;
    }
    digest
        .needs_attention
        .iter()
        .find(|i| i.kind == "regressed")
        .map(|i| i.title.clone())
        .or_else(|| Some(format!("{} prompt file(s) regressed", digest.regressed)))
}

/// A short one-line summary for the weekly digest notification.
pub fn digest_summary(digest: &ScansDigest) -> String {
    format!(
        "Overall {}. {} improved, {} regressed.",
        digest.overall_grade.letter(),
        digest.improved,
        digest.regressed
    )
}

/// Send a native notification (best-effort).
pub fn send(app: &AppHandle, title: &str, body: &str) {
    let _ = app.notification().builder().title(title).body(body).show();
}

/// After a scan: fire a regression notification if enabled and warranted.
pub fn after_scan(app: &AppHandle, conn: &rusqlite::Connection) {
    if !enabled(conn, "notify_regressions") {
        return;
    }
    if let Ok(digest) = get_scans_digest(conn) {
        if let Some(body) = regression_message(&digest) {
            send(app, "A prompt grade dropped", &body);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::Grade;
    use crate::query::DigestItem;

    fn digest(regressed: u32, items: Vec<DigestItem>) -> ScansDigest {
        ScansDigest {
            has_data: true,
            overall_grade: Grade::C,
            net_health: 0,
            improved: 0,
            regressed,
            scan_count: 1,
            trend: Vec::new(),
            needs_attention: items,
        }
    }

    #[test]
    fn no_regression_no_message() {
        assert!(regression_message(&digest(0, Vec::new())).is_none());
    }

    #[test]
    fn regression_uses_first_item_title() {
        let item = DigestItem {
            kind: "regressed".to_string(),
            file_id: "f".to_string(),
            title: "CLAUDE.md dropped B → D".to_string(),
            detail: "x".to_string(),
        };
        let msg = regression_message(&digest(1, vec![item])).unwrap();
        assert!(msg.contains("dropped"));
    }

    #[test]
    fn summary_includes_grade() {
        assert!(digest_summary(&digest(0, Vec::new())).contains("Overall C"));
    }
}
