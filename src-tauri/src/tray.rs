//! System tray icon + menu (the menu-bar presence).
//!
//! Left-click toggles the floating panel under the icon; right-click keeps the
//! native menu for the quick actions the panel does not cover.

use tauri::menu::MenuBuilder;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::App;

use crate::{panel, window_policy};

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
            "open" => window_policy::show_main(app),
            "scan" => {
                let app = app.clone();
                tauri::async_runtime::spawn(async move {
                    crate::commands::scan_everything(&app);
                });
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // Only the release of a left-click: the press half of the same
            // click would toggle the panel straight back shut.
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                rect,
                ..
            } = event
            {
                panel::toggle(tray.app_handle(), rect);
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
}
