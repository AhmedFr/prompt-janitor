//! Build script: registers the app's own commands with Tauri's ACL.
//!
//! Without an app manifest, Tauri treats every `#[tauri::command]` as
//! allowed for every window — so the tray panel could reset or uninstall the
//! app and the capabilities under `capabilities/` only ever governed plugin
//! commands. Registering the commands here turns each into an
//! `allow-<command>` / `deny-<command>` permission that a capability has to
//! grant explicitly, per window. `tauri-build` fails the build when a
//! capability names a permission that does not exist, so a typo in either
//! place is caught at compile time rather than as a silent denial at runtime.
//!
//! The list itself lives in `src/command_names.rs` and is `include!`d below:
//! a build script runs before the crate exists and cannot `use` it, and a
//! test in `src/ipc.rs` keeps that file equal to what `collect_commands!`
//! registers. A command missing from it is denied for every window.
//!
//! `capabilities/default.json` grants the main window every command except
//! the three only the tray panel calls (`get_panel_snapshot`, `open_main`,
//! `quit`) — deliberately including the handful no screen invokes today
//! (`ping`, `get_overview`, `set_pack`, `get_pack`, `list_templates`,
//! `list_harnesses`), so a future screen does not hit an ACL denial that
//! nothing in the test suite would catch. `capabilities/panel.json` grants
//! the panel its four commands and nothing destructive.
//!
//! The webview's Content-Security-Policy lives in `tauri.conf.json`, where
//! comments are not allowed, so its rationale is kept here:
//!
//! - `default-src 'self'` / `script-src 'self'`: only the bundled assets run.
//!   Tauri's own initialization scripts are injected as WKUserScripts and sit
//!   outside the CSP; what Tauri appends to the policy are hashes for the
//!   inline scripts and styles it finds in the built `index.html`, so
//!   production needs no `'unsafe-inline'` for scripts.
//! - `style-src 'unsafe-inline'`: React and Recharts set inline `style`
//!   attributes; there is no way to nonce those. CSP level 2 makes browsers
//!   ignore `'unsafe-inline'` as soon as a hash or nonce appears in the same
//!   directive — so an inline `<style>` in `dist/index.html` (a critical-CSS
//!   plugin, say) would get hashed by Tauri and silently break every
//!   `style=` attribute in the app. Keep styles in stylesheets.
//! - `img-src data:`: project logos are built in Rust as `data:` URIs and
//!   rendered by `<img>` (`src/components/ProjectGlyph`).
//! - `font-src 'self'`: no external fonts are loaded.
//! - `connect-src ipc: http://ipc.localhost`: the IPC transport on macOS
//!   (custom scheme) and elsewhere (localhost origin).
//! - `object-src`, `base-uri`, `frame-ancestors` all `'none'`: nothing
//!   embeds, rebases or frames the app.
//! - `devCsp` additionally allows `script-src 'unsafe-inline'` for the Vite
//!   React-refresh preamble and `connect-src` to the dev server and its HMR
//!   websocket on port 1420. Note that Tauri only injects a CSP into assets
//!   it serves itself: under `pnpm dev` the page comes straight from Vite
//!   with `build.devUrl`, so `devCsp` is documentation more than
//!   enforcement. A bundled build (`pnpm tauri build --debug` is the fast
//!   path) is the only place the policy is actually applied.

include!("src/command_names.rs");

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
    )
    .expect("failed to run tauri-build");
}
