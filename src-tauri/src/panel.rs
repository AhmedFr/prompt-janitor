//! The floating menu-bar panel window.
//!
//! Owns the `panel` webview window: creating it hidden at startup, placing it
//! under the tray icon, and toggling it on a left-click. Everything that can be
//! decided without a window server — the placement clamps, which monitor a point
//! falls on, whether a click is the tail of a blur — is a pure function with
//! tests; the rest is a thin shell over the Tauri API.

use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{App, AppHandle, LogicalPosition, Manager, Monitor, WebviewUrl, WebviewWindowBuilder};

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
        // Above the icon instead — but a work area too short for either side
        // must still start inside it rather than off the top.
        (icon.y - PANEL_GAP - h).max(work_area.y + PANEL_MARGIN)
    } else {
        below
    };

    (x, y)
}

/// How long after a blur-hide a tray click still counts as "the panel was open".
const BLUR_TOGGLE_WINDOW: Duration = Duration::from_millis(250);

/// When the blur handler last hid the panel.
static LAST_BLUR_HIDE: Mutex<Option<Instant>> = Mutex::new(None);

/// Whether a tray click landing at `now` is the tail of the blur that a
/// mouse-down on the status item already caused.
///
/// macOS gives the status item key on mouse-**down**, so an open panel has
/// blurred itself shut before the mouse-**up** that toggles it arrives. Without
/// this the click would read the panel as closed and re-open it, and the icon
/// could never close the panel.
fn swallow(last: Option<Instant>, now: Instant) -> bool {
    last.is_some_and(|t| now.saturating_duration_since(t) < BLUR_TOGGLE_WINDOW)
}

/// Read and clear the blur stamp. Clearing matters: a stamp left behind would
/// swallow the *next* click too.
fn take_blur_stamp() -> Option<Instant> {
    LAST_BLUR_HIDE
        .lock()
        .ok()
        .and_then(|mut stamp| stamp.take())
}

/// Whether the physical point `(px, py)` falls on a monitor with this physical
/// origin, physical size and scale factor.
///
/// Both the point and the rect are taken into that monitor's own logical space
/// first: macOS lays displays out in a shared point space and tao reports each
/// monitor's origin already multiplied by *its own* scale, so physical
/// coordinates from different displays are not comparable as they stand.
fn contains_logical(pos: (f64, f64), size: (f64, f64), scale: f64, px: f64, py: f64) -> bool {
    let scale = if scale > 0.0 { scale } else { 1.0 };
    let (x, y) = (pos.0 / scale, pos.1 / scale);
    let (w, h) = (size.0 / scale, size.1 / scale);
    let (lx, ly) = (px / scale, py / scale);

    lx >= x && lx < x + w && ly >= y && ly < y + h
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
    // A blur-hide moments ago means this click closed an *open* panel; treat it
    // as visible so the click closes rather than re-opens it.
    if swallow(take_blur_stamp(), Instant::now()) || window.is_visible().unwrap_or(false) {
        let _ = window.hide();
        return;
    }
    let (icon, work_area) = logical_geometry(app, icon);
    // The panel resizes itself to its content, so the constant is only the size
    // it was *built* at. Placing with it would push a short panel down by the
    // difference — the gap under the icon is what the clamp is measuring from.
    let size = live_size(&window).unwrap_or(PANEL_SIZE);
    let (x, y) = position_under(icon, work_area, size);
    let _ = window.set_position(LogicalPosition::new(x, y));
    let _ = window.show();
    // Focus is what makes the blur handler able to close the panel again.
    let _ = window.set_focus();
}

/// The panel's current size in logical pixels, or `None` if the window cannot
/// be measured. No IPC: both values come from the window itself.
fn live_size(window: &tauri::WebviewWindow) -> Option<(f64, f64)> {
    let scale = window.scale_factor().ok()?;
    let size = window.inner_size().ok()?.to_logical::<f64>(scale);
    Some((size.width, size.height))
}

/// Hide the panel if it exists. Used by `open_main`.
pub fn hide(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(PANEL_LABEL) {
        let _ = window.hide();
    }
}

/// Forget any blur stamp, so the next tray click is judged on its own.
///
/// Raising the main window blurs the panel, which stamps a blur the user never
/// caused. Without this, a tray click within the toggle window right after a
/// panel row was clicked would be read as "this click closed an open panel" and
/// swallowed, leaving the icon looking dead.
pub fn clear_blur_stamp() {
    let _ = take_blur_stamp();
}

/// The `WindowEvent::Focused(false)` handler: hide, and record when, so the
/// tray click that caused the blur can tell it closed an open panel.
pub fn hide_on_blur(app: &AppHandle) {
    hide(app);
    if let Ok(mut stamp) = LAST_BLUR_HIDE.lock() {
        *stamp = Some(Instant::now());
    }
}

/// The monitor the physical point `(px, py)` falls on.
///
/// `AppHandle::monitor_from_point` cannot be used here: on macOS tao resolves it
/// with `CGDisplayBounds`, which is point space, while the tray hands us physical
/// pixels — on a multi-display setup that lands on the wrong screen. Each
/// candidate is tested in its own logical space instead. Overlaps are broken by
/// the nearest top edge, which only helps for vertically stacked displays: two
/// side-by-side displays with different scale factors can both claim a point
/// (the physical value cannot be inverted without knowing its display), and
/// then the first monitor reported wins. Owner verifies on-device; an `NSScreen`
/// lookup from `NSEvent::mouseLocation` would make this exact on macOS.
fn monitor_for(app: &AppHandle, px: f64, py: f64) -> Option<Monitor> {
    let top_distance = |m: &Monitor| {
        let scale = m.scale_factor();
        let scale = if scale > 0.0 { scale } else { 1.0 };
        (py / scale - f64::from(m.position().y) / scale).abs()
    };

    app.available_monitors()
        .unwrap_or_default()
        .into_iter()
        .filter(|m| {
            contains_logical(
                (f64::from(m.position().x), f64::from(m.position().y)),
                (f64::from(m.size().width), f64::from(m.size().height)),
                m.scale_factor(),
                px,
                py,
            )
        })
        .min_by(|a, b| {
            top_distance(a)
                .partial_cmp(&top_distance(b))
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .or_else(|| app.primary_monitor().ok().flatten())
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

    let monitor = monitor_for(app, position.x, position.y);

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
        // No monitor at all: a synthetic work area centred on the icon, so the
        // clamp still yields a centred panel.
        .unwrap_or(Rect {
            x: icon.x + icon.w / 2.0 - PANEL_SIZE.0 / 2.0 - PANEL_MARGIN,
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

    #[test]
    fn keeps_the_flipped_panel_inside_a_work_area_too_short_for_it() {
        // 300 px tall: neither below (30 + 480) nor above (0 − 6 − 480) fits, so
        // the panel starts at the top margin instead of off-screen.
        let short = Rect {
            y: 25.0,
            h: 300.0,
            ..WORK_AREA
        };
        assert_eq!(position_under(icon_at(700.0), short, SIZE), (532.0, 33.0));
    }

    #[test]
    fn hugs_the_left_margin_when_the_work_area_is_narrower_than_the_panel() {
        // max_x (300 − 360 − 8) falls below min_x (8): the clamp range is empty.
        let narrow = Rect {
            w: 300.0,
            ..WORK_AREA
        };
        assert_eq!(position_under(icon_at(150.0), narrow, SIZE), (8.0, 30.0));
    }

    #[test]
    fn swallows_a_click_arriving_inside_the_blur_window() {
        let blur = Instant::now();
        assert!(swallow(Some(blur), blur + Duration::from_millis(100)));
    }

    #[test]
    fn lets_through_a_click_arriving_after_the_blur_window() {
        let blur = Instant::now();
        assert!(!swallow(Some(blur), blur + Duration::from_millis(300)));
    }

    #[test]
    fn lets_through_a_click_with_no_recorded_blur() {
        assert!(!swallow(None, Instant::now()));
    }

    /// `open_main` hides the panel itself; the blur that raising the main window
    /// caused must not then eat the user's next tray click.
    #[test]
    fn clearing_the_blur_stamp_lets_the_next_click_through() {
        *LAST_BLUR_HIDE.lock().unwrap() = Some(Instant::now());
        clear_blur_stamp();
        assert!(!swallow(take_blur_stamp(), Instant::now()));
    }

    /// A 1440 × 900 non-Retina display at the origin.
    const PRIMARY: ((f64, f64), (f64, f64), f64) = ((0.0, 0.0), (1440.0, 900.0), 1.0);
    /// A 2× display to its right: logical origin 1440, so physical origin 2880.
    const SECONDARY_2X: ((f64, f64), (f64, f64), f64) = ((2880.0, 0.0), (2560.0, 1440.0), 2.0);

    fn contains(m: ((f64, f64), (f64, f64), f64), px: f64, py: f64) -> bool {
        contains_logical(m.0, m.1, m.2, px, py)
    }

    #[test]
    fn a_point_on_the_primary_display_matches_only_it() {
        assert!(contains(PRIMARY, 700.0, 5.0));
        assert!(!contains(SECONDARY_2X, 700.0, 5.0));
    }

    #[test]
    fn a_point_on_a_2x_secondary_display_matches_only_it() {
        // Logical (2000, 5) on the secondary → physical (4000, 10).
        assert!(contains(SECONDARY_2X, 4000.0, 10.0));
        assert!(!contains(PRIMARY, 4000.0, 10.0));
    }

    #[test]
    fn a_point_past_the_right_edge_matches_nothing() {
        assert!(!contains(PRIMARY, 6000.0, 5.0));
        assert!(!contains(SECONDARY_2X, 6000.0, 5.0));
    }
}
