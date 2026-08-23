//! Menu-bar-first window policy for the main window.
//!
//! Prompt Janitor lives in the menu bar: closing the main window hides it and
//! drops the Dock icon rather than quitting, and anything that opens the window
//! again brings the Dock icon back. Both halves are here so the tray, the panel
//! and the `CloseRequested` handler cannot drift apart.
//!
//! The Dock is a macOS concept; on other platforms the policy calls are no-ops
//! and only the show/hide remains.

use tauri::{AppHandle, Manager};

/// Window label of the app shell.
pub const MAIN_LABEL: &str = "main";

/// Show the main window and put the app back in the Dock.
pub fn show_main(app: &AppHandle) {
    // Policy first: on macOS a window shown while the app is an accessory can
    // come up behind the frontmost app.
    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);

    if let Some(window) = app.get_webview_window(MAIN_LABEL) {
        // A minimized window is "visible" to Tauri; showing it alone would
        // leave it in the Dock's minimized shelf.
        if window.is_minimized().unwrap_or(false) {
            let _ = window.unminimize();
        }
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Hide the main window and leave only the menu-bar presence.
pub fn hide_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_LABEL) {
        let _ = window.hide();
    }

    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
}
