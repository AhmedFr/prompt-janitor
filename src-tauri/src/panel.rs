//! The floating menu-bar panel window.
//!
//! Owns the `panel` webview window: creating it hidden at startup, placing it
//! under the tray icon, and toggling it on a left-click. The geometry is a pure
//! function so the clamping rules can be tested without a window server.

use tauri::{App, AppHandle, LogicalPosition, Manager, WebviewUrl, WebviewWindowBuilder};

/// Window label of the panel.
pub const PANEL_LABEL: &str = "panel";
/// Panel size in logical pixels.
pub const PANEL_SIZE: (f64, f64) = (360.0, 480.0);
/// Distance between the tray icon's edge and the panel.
pub const PANEL_GAP: f64 = 6.0;
/// Minimum distance between the panel and the edge of the work area.
pub const PANEL_MARGIN: f64 = 8.0;

/// The page the panel renders. `main.tsx` branches on the query string, which
/// keeps window detection out of Storybook and the component tests.
const PANEL_URL: &str = "index.html?window=panel";

/// A rectangle in logical pixels, top-left origin.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

/// Place the panel under the tray icon, kept inside the monitor's work area.
///
/// Centred on the icon, `PANEL_GAP` below its bottom edge, clamped to
/// `PANEL_MARGIN` from either side, and flipped above the icon when the panel
/// would otherwise hang off the bottom of the work area.
pub fn position_under(icon: Rect, work_area: Rect, size: (f64, f64)) -> (f64, f64) {
    let (w, h) = size;

    let min_x = work_area.x + PANEL_MARGIN;
    let max_x = work_area.x + work_area.w - w - PANEL_MARGIN;
    let x = icon.x + icon.w / 2.0 - w / 2.0;
    // A work area narrower than the panel leaves no valid range; hugging the
    // left margin is the readable half.
    let x = if max_x < min_x {
        min_x
    } else {
        x.clamp(min_x, max_x)
    };

    let below = icon.y + icon.h + PANEL_GAP;
    let y = if below + h > work_area.y + work_area.h {
        icon.y - PANEL_GAP - h
    } else {
        below
    };

    (x, y)
}

/// Create the panel window, hidden. Call once at startup: building it up front
/// means the first left-click shows an already-loaded webview.
pub fn create(app: &App) -> tauri::Result<()> {
    if app.get_webview_window(PANEL_LABEL).is_some() {
        return Ok(());
    }
    WebviewWindowBuilder::new(app, PANEL_LABEL, WebviewUrl::App(PANEL_URL.into()))
        .title("Prompt Janitor")
        .inner_size(PANEL_SIZE.0, PANEL_SIZE.1)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .resizable(false)
        .skip_taskbar(true)
        .visible(false)
        .focused(false)
        .build()?;
    Ok(())
}

/// Left-click behaviour: an open panel closes, a closed one opens under the icon.
pub fn toggle(app: &AppHandle, icon: tauri::Rect) {
    let Some(window) = app.get_webview_window(PANEL_LABEL) else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
        return;
    }
    let (icon, work_area) = logical_geometry(app, icon);
    let (x, y) = position_under(icon, work_area, PANEL_SIZE);
    let _ = window.set_position(LogicalPosition::new(x, y));
    let _ = window.show();
    // Focus is what makes the blur handler able to close the panel again.
    let _ = window.set_focus();
}

/// Hide the panel if it exists. Used by the blur handler and by `open_main`.
pub fn hide(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(PANEL_LABEL) {
        let _ = window.hide();
    }
}

/// Convert the tray icon's physical rect into logical pixels, alongside the
/// work area of the monitor it sits on.
///
/// The tray event always reports physical pixels; window positions are set in
/// logical ones, so both go through the icon's own monitor scale factor. A
/// monitor we cannot identify falls back to the primary one, and a work area
/// the platform reports as empty falls back to the full monitor rect.
fn logical_geometry(app: &AppHandle, icon: tauri::Rect) -> (Rect, Rect) {
    let position = icon.position.to_physical::<f64>(1.0);
    let size = icon.size.to_physical::<f64>(1.0);

    let monitor = app
        .monitor_from_point(position.x, position.y)
        .ok()
        .flatten()
        .or_else(|| app.primary_monitor().ok().flatten());

    let scale = monitor.as_ref().map(|m| m.scale_factor()).unwrap_or(1.0);
    let scale = if scale > 0.0 { scale } else { 1.0 };

    let icon = Rect {
        x: position.x / scale,
        y: position.y / scale,
        w: size.width / scale,
        h: size.height / scale,
    };

    let work_area = monitor
        .as_ref()
        .map(|m| {
            let area = m.work_area();
            if area.size.width > 0 && area.size.height > 0 {
                Rect {
                    x: f64::from(area.position.x) / scale,
                    y: f64::from(area.position.y) / scale,
                    w: f64::from(area.size.width) / scale,
                    h: f64::from(area.size.height) / scale,
                }
            } else {
                Rect {
                    x: f64::from(m.position().x) / scale,
                    y: f64::from(m.position().y) / scale,
                    w: f64::from(m.size().width) / scale,
                    h: f64::from(m.size().height) / scale,
                }
            }
        })
        .unwrap_or(Rect {
            x: icon.x,
            y: icon.y,
            w: PANEL_SIZE.0 + 2.0 * PANEL_MARGIN,
            h: PANEL_SIZE.1 + icon.h + PANEL_GAP,
        });

    (icon, work_area)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A 1440 × 900 display with a 25 px menu bar along the top.
    const WORK_AREA: Rect = Rect {
        x: 0.0,
        y: 25.0,
        w: 1440.0,
        h: 875.0,
    };
    const SIZE: (f64, f64) = (360.0, 480.0);

    fn icon_at(x: f64) -> Rect {
        Rect {
            x,
            y: 0.0,
            w: 24.0,
            h: 24.0,
        }
    }

    #[test]
    fn centres_under_the_icon() {
        // centre 712 − 180 = 532; bottom 24 + gap 6 = 30
        assert_eq!(
            position_under(icon_at(700.0), WORK_AREA, SIZE),
            (532.0, 30.0)
        );
    }

    #[test]
    fn clamps_to_the_left_margin() {
        // centre 12 − 180 = −168, pulled back to work_area.left + 8
        assert_eq!(position_under(icon_at(0.0), WORK_AREA, SIZE), (8.0, 30.0));
    }

    #[test]
    fn clamps_to_the_right_margin() {
        // centre 1422 − 180 = 1242, pushed back to 1440 − 360 − 8
        assert_eq!(
            position_under(icon_at(1410.0), WORK_AREA, SIZE),
            (1072.0, 30.0)
        );
    }

    #[test]
    fn flips_above_the_icon_when_it_would_overflow_the_bottom() {
        // A bottom-edge tray (Windows taskbar): 884 + 6 + 480 > 900, so the
        // panel sits gap-above the icon instead: 860 − 6 − 480.
        let icon = Rect {
            x: 700.0,
            y: 860.0,
            w: 24.0,
            h: 24.0,
        };
        assert_eq!(position_under(icon, WORK_AREA, SIZE), (532.0, 374.0));
    }
}
