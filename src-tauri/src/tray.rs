//! System tray icon + menu (the menu-bar presence).
//!
//! Left-click shows the main window; right-click opens a menu with quick
//! actions. The rich floating popover panel is tracked separately (#50).

use tauri::menu::MenuBuilder;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{App, AppHandle, Manager};

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Build and install the tray icon. Call once at startup.
pub fn setup(app: &App) -> tauri::Result<()> {
    let menu = MenuBuilder::new(app)
        .text("open", "Open Prompt Janitor")
        .text("scan", "Scan now")
        .separator()
        .text("quit", "Quit")
        .build()?;

    let mut builder = TrayIconBuilder::new()
        .tooltip("Prompt Janitor")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => show_main(app),
            "scan" => {
                let app = app.clone();
                tauri::async_runtime::spawn(async move {
                    crate::commands::scan_configured_folder(&app);
                });
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
}
