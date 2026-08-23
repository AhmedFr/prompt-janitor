# Menu-bar panel — design

**Date:** 2026-08-23
**Status:** approved in brainstorm (owner chose content, click model, Dock behaviour)
**Supersedes the deferral in:** issue #50 (rich floating menu-bar popover)
**Builds on:** phase 7 (harness inventory + usage index), phase 8 (tables, project pages)

## 1. Why

The tray icon today opens a three-item native menu. The product's promise is a calm
background janitor: the 10-second "is my setup good enough?" answer should be one click
away in the menu bar, without opening the full window. Phase 7 added the signals that make
that panel worth opening (never-used skills, erroring MCP servers, sessions).

## 2. Scope

1. A floating **panel window** under the menu-bar icon: verdict + top-3 fixes + usage
   signals + Scan now / Open app / Quit.
2. **Click model:** left-click toggles the panel; right-click keeps the native menu.
3. **Menu-bar-first:** closing the main window hides it and drops the Dock icon; opening
   it from the panel or the menu restores both.
4. A cross-window **`open_main(route, target)`** command so panel rows land on the right
   screen of the main window.

Out of scope: native `NSPopover` arrow styling, Windows/Linux positioning verification
(code is cross-platform; verified on macOS only), notifications deep-linking into the panel,
any change to what notifications say.

## 3. Architecture

### 3.1 Windows

| Label | Role | Config |
|---|---|---|
| `main` | the app shell (unchanged) | as today; `CloseRequested` → `hide()` + `ActivationPolicy::Accessory` |
| `panel` | the popover | created hidden at startup by `panel.rs`: 360 × 480, `decorations(false)`, `transparent(true)`, `always_on_top(true)`, `resizable(false)`, `skip_taskbar(true)`, `visible(false)`, `focused(true)` when shown, url `index.html?window=panel` |

`tauri.conf.json` gains `"macOSPrivateApi": true` (required for a transparent webview on
macOS). The panel's webview background is transparent; the React root paints a rounded card
(`--bg`, 12 px radius, `--shadow-pop`) so the window's corners stay see-through.

### 3.2 Rust modules (single responsibility each)

- `tray.rs` — builds the tray; left-click `Click { button: Left, button_state: Up, rect, .. }`
  → `panel::toggle(app, rect)`; right-click menu unchanged (Open / Scan now / Quit), "Open" →
  `window_policy::show_main(app)`.
- `panel.rs` (new) — `create(app)`, `toggle(app, rect)`, `position_under(rect, monitor)`
  (pure, tested: centred on the icon, clamped inside the monitor's work area, 6 px below
  the icon's bottom edge), `hide_on_blur` (the `WindowEvent::Focused(false)` handler).
- `window_policy.rs` (new) — `show_main(app)` = show + focus + `set_activation_policy(Regular)`;
  `hide_main(app)` = hide + `Accessory`. Called from tray, panel `open_main`, and the
  `main` window's `CloseRequested` handler (which `api.prevent_close()`). Non-macOS builds
  compile the policy calls to no-ops.
- `commands.rs` — `open_main(app, route: String, target: Option<String>)`: `show_main` then
  emit `navigate` `{ route, target }` to the `main` webview, then hide the panel.
  `get_panel_snapshot(db)` → `PanelSnapshot`.
- `query.rs` / `harness_query.rs` — `panel_snapshot(conn, now)` composes existing reads;
  no new tables.

### 3.3 `PanelSnapshot` (IPC types i32/u32/f64/String/bool only)

```rust
pub struct PanelFix { file_id: String, name: String, project_name: String, grade: Grade, issue_count: u32 }
pub struct PanelSnapshot {
  has_data: bool,
  overall_grade: Grade, overall_score: u32, delta: i32,      // from get_overview
  last_scan_at: Option<String>,                             // harnesses max(last_scan_at) else scans max(finished_at)
  top_fixes: Vec<PanelFix>,                                 // ≤ 3, issue_count > 0, worst grade then most issues
  never_used_skills: u32,                                   // artifacts kind=skill with no usage row, all non-plugin layers
  mcp_erroring: u32,                                        // mcp_server artifacts with error_rate ≥ 0.25 (shared threshold)
  sessions_today: u32,                                      // sessions started since local midnight (UTC day like project_usage)
}
```

Scan state is not in the snapshot: the panel listens to `scan-phase` / `scan-progress` /
`scan-done` like Setup does and refetches on `scan-done`.

### 3.4 Frontend

- `src/main.tsx`: `new URLSearchParams(location.search).get("window") === "panel"` → render
  `<Panel />` (no App shell, no onboarding). Query-string detection keeps Storybook and
  tests free of Tauri window APIs.
- `src/screens/Panel/` — `Panel.tsx` (layout), `usePanel.ts` (fetch on mount and on the
  window `focus` event — the panel is re-shown with focus every time; scan events),
  `panel.util.ts` (+tests: verdict line, delta copy, chip tone), `Panel.constants.ts`,
  `Panel.css`, `Panel.test.tsx`, `Panel.stories.tsx`, and sections as folders:
  `PanelHeader/` (mini `ScoreRing` 56 px, verdict line "Good enough" / "Needs work" /
  "Fix now" by grade, delta, last scan relative), `PanelFixes/` (top-3 rows: glyph, name,
  project, `Grade`, issues → `open_main("detail", file_id)`), `PanelSignals/` (three chips:
  "N never-used skills" → `open_main("setup","skill")`, "N MCP erroring" →
  `open_main("setup","mcp_server")`, "N sessions today" → `open_main("analytics")`; tone
  error when N > 0 for the first two), `PanelFooter/` (Scan now with `ScanBar` while
  scanning, Open app → `open_main("overview")`, Quit → `commands.quit()` (new, `app.exit(0)`)).
- States: loading skeleton; `!has_data` → "No scan yet" + Scan now; failure panel (shared
  copy pattern); Esc → `getCurrentWindow().hide()`.
- `App.tsx`: listen to `navigate` and call `navigate(route, target)` with the `Route` guard
  (`isRoute`), ignore unknown routes. Tested in `App.test.tsx`.

### 3.5 Positioning rules (pure, tested)

`position_under(icon: Rect, work_area: Rect, size: (w,h)) -> (x,y)`: `x = icon.center_x −
w/2`, `y = icon.bottom + 6`; clamp `x` into `[work_area.left + 8, work_area.right − w − 8]`;
if `y + h > work_area.bottom` put the panel above the icon instead. Logical pixels from the
event's `rect` (Tauri hands both position and size; convert with the monitor scale factor).

## 4. Testing

- Rust: `panel_snapshot` on the fixture DB (top-3 ordering, counts, `has_data=false` on an
  empty DB); `position_under` clamping cases; `open_main` route passthrough is thin enough to
  cover by the frontend `navigate` test.
- Frontend: util tests; `Panel.test.tsx` with mocked IPC + mocked `@tauri-apps/api/window`
  (sections render from snapshot, each click → `open_main` args, scan events disable the
  button and show progress, `scan-done` refetches, Esc hides, empty/failure states, axe);
  stories Populated / NoScan / Scanning / Failure; `App.test.tsx` `navigate` event case.
- Gates unchanged (Rust trio, frontend four). Visual positioning and transparency need the
  owner on a real Mac — listed under status `actions`.

## 5. Delivery

Two PRs, one issue each:
1. **Backend + window plumbing** — `panel.rs`, `window_policy.rs`, tray click model, Dock
   policy, `open_main`/`quit`/`get_panel_snapshot`, conf changes, bindings.
2. **Panel UI** — `src/screens/Panel/**`, `main.tsx` branch, App `navigate` listener, docs/status.
