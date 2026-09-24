//! Best-effort project logo detection. Given a project root, look for a small
//! set of conventional logo files and return the first as a base64 `data:`
//! URI. Bounded, size-capped, and degrades to `None` on any error.
//!
//! The probe list follows where projects actually keep their mark rather than
//! where one would like them to: Next's app router (`src/app/icon.png`), Expo
//! (`assets/icon.png`), Tauri (`src-tauri/icons/128x128.png`), a `brand/`
//! folder, and — for a monorepo — the same places inside each `apps/*`.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use base64::Engine;

/// Max logo size we inline (256 KB). Larger files are skipped.
const MAX_BYTES: u64 = 256 * 1024;

/// Directories under a root to probe, in order.
const DIRS: &[&str] = &[
    "",
    "public",
    "public/brand",
    "assets",
    "app",
    "src/app",
    "src/assets",
    ".github",
    "build",
    "src-tauri/icons",
];

/// Base names, in tiers: every directory is searched for a tier before any
/// directory is searched for the next, so a `public/logo.svg` beats a 16px
/// root `favicon.ico`.
const NAME_TIERS: &[&[&str]] = &[
    &["logo"],
    &[
        "icon",
        "apple-icon",
        "apple-touch-icon",
        "logo512",
        "logo192",
        "128x128@2x",
        "128x128",
    ],
    &["favicon"],
];

/// Extension → MIME. Order also sets preference (svg first).
const EXTS: &[(&str, &str)] = &[
    ("svg", "image/svg+xml"),
    ("png", "image/png"),
    ("jpg", "image/jpeg"),
    ("jpeg", "image/jpeg"),
    ("ico", "image/x-icon"),
];

/// Monorepo containers whose children are probed when the root has no logo.
/// `apps/` only: a `packages/ui` or `packages/icons` holds icons *for* the
/// product, and picking one of those would put a random glyph on the project.
const WORKSPACE_DIRS: &[&str] = &["apps"];

/// Cap on children probed per workspace dir, so a huge `apps/` stays cheap.
const MAX_WORKSPACE_CHILDREN: usize = 12;

/// Return a `data:` URI for the project's logo, or `None`.
pub fn detect_logo(root: &Path) -> Option<String> {
    std::iter::once(root.to_path_buf())
        .chain(workspace_children(root))
        .find_map(|base| detect_in(&base))
}

/// The tiered probe over one root (the project, or one monorepo app).
fn detect_in(base: &Path) -> Option<String> {
    // One `read_dir` per directory instead of a `stat` per candidate name.
    let listings: Vec<(PathBuf, HashMap<String, String>)> = DIRS
        .iter()
        .map(|dir| {
            if dir.is_empty() {
                base.to_path_buf()
            } else {
                base.join(dir)
            }
        })
        .filter_map(|dir| list(&dir).map(|names| (dir, names)))
        .collect();
    for tier in NAME_TIERS {
        for (dir, names) in &listings {
            for name in *tier {
                for (ext, mime) in EXTS {
                    let Some(file) = names.get(&format!("{name}.{ext}")) else {
                        continue;
                    };
                    if let Some(uri) = try_read(&dir.join(file), mime) {
                        return Some(uri);
                    }
                }
            }
        }
    }
    None
}

/// File names directly inside `dir`, keyed lowercased so `Logo.PNG` matches
/// `logo.png`; `None` when the directory cannot be read.
fn list(dir: &Path) -> Option<HashMap<String, String>> {
    let entries = std::fs::read_dir(dir).ok()?;
    Some(
        entries
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .map(|name| (name.to_lowercase(), name))
            .collect(),
    )
}

/// `apps/*` subdirectories, sorted so the pick is stable.
fn workspace_children(root: &Path) -> Vec<PathBuf> {
    WORKSPACE_DIRS
        .iter()
        .flat_map(|ws| {
            let mut children: Vec<PathBuf> = std::fs::read_dir(root.join(ws))
                .into_iter()
                .flatten()
                .filter_map(|e| e.ok())
                .map(|e| e.path())
                .filter(|p| p.is_dir())
                .collect();
            children.sort();
            children.truncate(MAX_WORKSPACE_CHILDREN);
            children
        })
        .collect()
}

fn try_read(path: &Path, mime: &str) -> Option<String> {
    let meta = std::fs::metadata(path).ok()?;
    if !meta.is_file() || meta.len() > MAX_BYTES {
        return None;
    }
    let bytes = std::fs::read(path).ok()?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Some(format!("data:{mime};base64,{b64}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn finds_root_logo_and_encodes_data_uri() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("logo.png"), b"\x89PNG\r\n").unwrap();
        let uri = detect_logo(dir.path()).unwrap();
        assert!(uri.starts_with("data:image/png;base64,"));
    }

    #[test]
    fn prefers_svg_over_png() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("logo.png"), b"png").unwrap();
        fs::write(dir.path().join("logo.svg"), b"<svg/>").unwrap();
        assert!(detect_logo(dir.path())
            .unwrap()
            .starts_with("data:image/svg+xml"));
    }

    #[test]
    fn looks_in_public_dir() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir_all(dir.path().join("public")).unwrap();
        fs::write(dir.path().join("public/icon.png"), b"x").unwrap();
        assert!(detect_logo(dir.path()).is_some());
    }

    #[test]
    fn skips_oversize_file() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(
            dir.path().join("logo.png"),
            vec![0u8; (MAX_BYTES + 1) as usize],
        )
        .unwrap();
        assert!(detect_logo(dir.path()).is_none());
    }

    /// Writes `bytes` at `rel` under `root`, creating the parent dirs.
    fn put(root: &Path, rel: &str, bytes: &[u8]) {
        let path = root.join(rel);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, bytes).unwrap();
    }

    #[test]
    fn finds_next_app_router_icon() {
        let dir = tempfile::tempdir().unwrap();
        put(dir.path(), "src/app/icon.png", b"png");
        assert!(detect_logo(dir.path()).is_some());
    }

    #[test]
    fn finds_expo_assets_icon() {
        let dir = tempfile::tempdir().unwrap();
        put(dir.path(), "assets/icon.png", b"png");
        assert!(detect_logo(dir.path()).is_some());
    }

    #[test]
    fn finds_tauri_bundle_icon() {
        let dir = tempfile::tempdir().unwrap();
        put(dir.path(), "src-tauri/icons/128x128.png", b"png");
        assert!(detect_logo(dir.path()).is_some());
    }

    #[test]
    fn finds_brand_folder_logo() {
        let dir = tempfile::tempdir().unwrap();
        put(dir.path(), "public/brand/logo.svg", b"<svg/>");
        assert!(detect_logo(dir.path()).is_some());
    }

    #[test]
    fn finds_logo_in_a_monorepo_app() {
        let dir = tempfile::tempdir().unwrap();
        put(dir.path(), "apps/web/public/logo512.png", b"png");
        assert!(detect_logo(dir.path()).is_some());
    }

    #[test]
    fn ignores_icons_inside_shared_packages() {
        let dir = tempfile::tempdir().unwrap();
        put(dir.path(), "packages/ui/assets/icon.svg", b"<svg/>");
        assert!(detect_logo(dir.path()).is_none());
    }

    #[test]
    fn prefers_a_named_logo_over_a_favicon() {
        let dir = tempfile::tempdir().unwrap();
        put(dir.path(), "favicon.ico", b"ico");
        put(dir.path(), "public/logo.svg", b"<svg/>");
        assert!(detect_logo(dir.path())
            .unwrap()
            .starts_with("data:image/svg+xml"));
    }

    #[test]
    fn matches_names_case_insensitively() {
        let dir = tempfile::tempdir().unwrap();
        put(dir.path(), "public/Logo.PNG", b"png");
        assert!(detect_logo(dir.path()).is_some());
    }

    #[test]
    fn none_when_no_logo() {
        let dir = tempfile::tempdir().unwrap();
        assert!(detect_logo(dir.path()).is_none());
    }
}
