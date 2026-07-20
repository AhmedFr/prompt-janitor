//! Best-effort project logo detection. Given a project root, look for a small
//! set of conventional logo files and return the first as a base64 `data:`
//! URI. Bounded, size-capped, and degrades to `None` on any error.

use std::path::Path;

use base64::Engine;

/// Max logo size we inline (256 KB). Larger files are skipped.
const MAX_BYTES: u64 = 256 * 1024;

/// Directories under the project root to probe, in order.
const DIRS: &[&str] = &["", "public", ".github"];

/// Base names to try in each dir, in order.
const NAMES: &[&str] = &["logo", "icon", "favicon"];

/// Extension → MIME. Order also sets preference (svg first).
const EXTS: &[(&str, &str)] = &[
    ("svg", "image/svg+xml"),
    ("png", "image/png"),
    ("jpg", "image/jpeg"),
    ("jpeg", "image/jpeg"),
    ("ico", "image/x-icon"),
];

/// Return a `data:` URI for the project's logo, or `None`.
pub fn detect_logo(root: &Path) -> Option<String> {
    for dir in DIRS {
        let base = if dir.is_empty() { root.to_path_buf() } else { root.join(dir) };
        for name in NAMES {
            for (ext, mime) in EXTS {
                let candidate = base.join(format!("{name}.{ext}"));
                if let Some(uri) = try_read(&candidate, mime) {
                    return Some(uri);
                }
            }
        }
    }
    None
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
        assert!(detect_logo(dir.path()).unwrap().starts_with("data:image/svg+xml"));
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
        fs::write(dir.path().join("logo.png"), vec![0u8; (MAX_BYTES + 1) as usize]).unwrap();
        assert!(detect_logo(dir.path()).is_none());
    }

    #[test]
    fn none_when_no_logo() {
        let dir = tempfile::tempdir().unwrap();
        assert!(detect_logo(dir.path()).is_none());
    }
}
