# Issue #171 — menu-bar panel visuals, round 2

Branch `fix/171-panel-visuals-2`, two commits, verified on this Mac by
screenshotting the running app.

## What was actually wrong

Three separate causes, not the two the brief assumed.

### 1. Opaque white window — a runtime-built window misses a config-only step

The Rust plumbing was already correct in v0.1.2 and the feature chain is intact:

- `src-tauri/Cargo.toml` enables `tauri/macos-private-api`; `tauri.conf.json`
  has `macOSPrivateApi: true`.
- `tauri/macos-private-api` → `tauri-runtime-wry/macos-private-api` →
  `wry/transparent` (which is *not* in wry's default features — this is the only
  route to it). The build fingerprint confirms wry compiled with `transparent`.
- `WebviewWindowBuilder::transparent(true)` sets **both** the tao window
  attribute (`setOpaque(false)` + `clearColor`) and `WebviewAttributes.transparent`,
  which wry turns into `drawsBackground = NO` on the `WKWebViewConfiguration`.
  The `#[cfg]` is compile-time: on macOS without the feature the method would not
  exist at all, so a silent runtime drop is impossible.

What was missing is the *webview background colour*. wry only clears
`underPageBackgroundColor` (macOS 12+) when an explicit background colour is
given; left unset, WKWebView resolves it to an opaque system background — a white
rectangle painted over the whole view, which is exactly what the card's rounded
corners were sitting inside. A window declared in `tauri.conf.json` gets this for
free (`tauri-runtime-wry` applies `config.background_color` on the config path);
a window built at runtime, as the panel is, does not. That asymmetry is the bug.

Fix: `.background_color(Color(0, 0, 0, 0))` on the builder.

The CSS was *not* the cause, though it was fragile: `html.panel-window body`
already out-specified `body { background: var(--content) }` despite `Panel.css`
landing earlier in the bundle. Those rules moved to `src/styles/base.css`
(imported by `main.tsx` itself, so no component-import ordering risk) and `#root`
joined `html` and `body`.

### 2. The "dark band" is scroll bars, not a stale shadow

The first on-device capture showed a dark bar down the right edge **and** along
the bottom, with rounded caps. That is a Mac set to *Show scroll bars: Always*
painting legacy scroll bars on a scrollable document — over a transparent page
they render as solid dark slabs. Fix: `overflow: hidden` on
`html.panel-window` / `body`; only `.panel__body` scrolls, and it now has a thin
8 px popover-style thumb.

### 3. The native window shadow really is wrong — but as a frame, not a band

Tested directly: built once with `.shadow(true)` and once with `.shadow(false)`
and compared photographs. With the native shadow on, macOS draws a hard grey
**square-cornered frame** hugging the right and bottom edges of the card — the
shadow shape is cached from the window, and the window is a transparent rectangle
that then resizes after load (`usePanelSize`). With it off the popover is clean.

`.shadow(false)` it is. The card's own CSS shadow then needs somewhere to fall,
so the transparent inset went from 4 px a side to 12 px:

- `PANEL_WIDTH` 360 → 376, `PANEL_CARD_INSET` 8 → 24, `panel.rs` `PANEL_SIZE.0`
  360 → 376, `.panel { margin: 12px; max-height: 576px }`.
- `.panel` gets its own `0 3px 10px / 0 1px 2px` shadow rather than
  `--shadow-pop` (`0 12px 40px`), whose tail would be cut off by the window edge
  and read as a smudge. `--shadow-pop` is shared with TemplatePicker and
  Onboarding, so the token itself is untouched.

## Taste pass

One gutter: header, section label, grade badges and the primary button all start
14 px from the card edge. Fix rows are 38 px with a 10 px hover radius, the name
at the card's 13 px base; separators are inset to the text (`left: 40px`) and live
on the `li`, since a pseudo-element on the row would become a fifth grid column.
Hairlines (0.5 px) on the card border, footer rule and signal chips. Verdict
17/700 → 16/600 with tighter tracking. Footer buttons at the default size (~278 px
of buttons in a 324 px row). Section label 11 px / 600 / 0.06em / `--text-3`.

`RING_SIZE` was left at 56: `ScoreRing` has a fixed 9 px stroke, so shrinking the
ring makes it heavier, and the component is shared with three other screens.

## The debug hook

`PJ_PANEL_DEBUG=1` (env-gated only, present in release builds too — the
regression is a property of the release bundle):

- parks the panel at (200, 100) at launch,
- hides the main window (a transparent popover can only be judged by what shows
  through it),
- marks it visible on all Spaces — a full-screen app owns a Space of its own and
  the screenshot otherwise comes back showing whatever is in front,
- suppresses the blur-hide, so a screenshot tool taking focus does not close it.

```
PJ_PANEL_DEBUG=1 '/Applications/Prompt Janitor.app/Contents/MacOS/prompt-janitor'
```

`pins_panel` (the pure half) is unit-tested: exactly `"1"` arms it.

## Capture verdict

`screencapture` works on this machine — no permission problem, no black frames.
Four builds were photographed. Final state, panel parked over the desktop:

- The 12 px margin around the card is **the wallpaper**, all four sides. Rounded
  corners read as corners, not as clipped edges. No white rectangle.
- No dark band, no scroll bars.
- A soft shadow sits inside the inset and falls across whatever window is behind.
- Text lines up on one 14 px gutter; separators start at the file name.

Two caveats on the method: the capture only works when the desktop Space is
frontmost (the script activates Finder first), and the panel is drawn over
whatever windows happen to be behind it, so the backdrop varies shot to shot.

## Gate

`pnpm check` green on both commits (lint, 1031 vitest, vite build, storybook,
`cargo fmt`/`clippy -D warnings`/332 cargo tests, fulfillment, landing). Note the
worktree needed `pnpm install` in `fulfillment/` and `landing/` first — their
`node_modules` were absent, which fails the gate for reasons unrelated to this
change.

## Left for the owner

Live behaviour a screenshot cannot check: that the panel still lands under the
tray icon at its new 376 px width, hides on blur and on Esc, and that a tall
panel scrolls inside the card rather than moving the window. Added to
`docs/status/data.json` as a blocking action.
