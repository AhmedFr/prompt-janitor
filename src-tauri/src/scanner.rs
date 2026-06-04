//! Filesystem scanner: walk a folder and find AI prompt files.
//!
//! Uses ripgrep's `ignore` walker (so `.gitignore` is respected) plus a
//! `globset` of known prompt-file patterns. Hidden files are included on
//! purpose (e.g. `.cursorrules`), but `.git`/`node_modules`/`vendor` are pruned.

use std::path::Path;

use globset::{Glob, GlobSet, GlobSetBuilder};
use ignore::WalkBuilder;

/// A discovered prompt file with its contents.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct PromptFile {
    /// Absolute path on disk.
    pub path: String,
    /// Detected kind (e.g. `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `other`).
    pub kind: String,
    /// File contents.
    pub content: String,
    /// Last-modified time as seconds since the Unix epoch, if available.
    pub modified_unix: Option<i64>,
}

/// Default, user-extensible set of prompt-file glob patterns (matched against
/// the path relative to the scanned root).
const DEFAULT_PATTERNS: &[&str] = &[
    "**/CLAUDE.md",
    "**/AGENTS.md",
    "**/GEMINI.md",
    "**/.cursorrules",
    "**/.windsurfrules",
    "**/.clinerules",
    "**/.continuerules",
    "**/.cursor/rules/*.mdc",
    "**/.github/copilot-instructions.md",
];

/// Directory names that are always pruned.
const PRUNED_DIRS: &[&str] = &[".git", "node_modules", "vendor"];

fn default_globset() -> GlobSet {
    let mut builder = GlobSetBuilder::new();
    for pattern in DEFAULT_PATTERNS {
        // Patterns are compile-time constants, so this never fails.
        builder.add(Glob::new(pattern).expect("valid glob pattern"));
    }
    builder.build().expect("valid glob set")
}

/// Classify a file into a prompt-file kind from its name/path.
fn classify(path: &Path) -> String {
    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
    match name {
        "CLAUDE.md"
        | "AGENTS.md"
        | "GEMINI.md"
        | ".cursorrules"
        | ".windsurfrules"
        | ".clinerules"
        | ".continuerules"
        | "copilot-instructions.md" => name.to_string(),
        _ if name.ends_with(".mdc") => "cursor-rule".to_string(),
        _ => "other".to_string(),
    }
}

fn modified_unix(entry: &ignore::DirEntry) -> Option<i64> {
    entry
        .metadata()
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
}

/// Walk `root` and return every prompt file found, with contents.
///
/// Respects `.gitignore`, prunes `.git`/`node_modules`/`vendor`, and skips
/// files that cannot be read as UTF-8 text.
pub fn scan_folder(root: &Path) -> Vec<PromptFile> {
    let globset = default_globset();
    let mut found = Vec::new();

    let walker = WalkBuilder::new(root)
        .hidden(false)
        .git_ignore(true)
        .git_global(false)
        // Apply .gitignore even when the folder isn't a git repo, so behavior
        // is predictable across both repos and loose folders.
        .require_git(false)
        .filter_entry(|entry| {
            let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
            let name = entry.file_name().to_string_lossy();
            !(is_dir && PRUNED_DIRS.contains(&name.as_ref()))
        })
        .build();

    for entry in walker.flatten() {
        if !entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
            continue;
        }
        let path = entry.path();
        let rel = path.strip_prefix(root).unwrap_or(path);
        if !globset.is_match(rel) {
            continue;
        }
        let Ok(content) = std::fs::read_to_string(path) else {
            continue; // binary / unreadable — skip
        };
        found.push(PromptFile {
            path: path.to_string_lossy().into_owned(),
            kind: classify(path),
            content,
            modified_unix: modified_unix(&entry),
        });
    }

    found
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn finds_prompt_files_respecting_ignores() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();

        fs::write(root.join("CLAUDE.md"), "# claude").unwrap();
        fs::create_dir_all(root.join("frontend")).unwrap();
        fs::write(root.join("frontend/AGENTS.md"), "# agents").unwrap();
        fs::write(root.join(".cursorrules"), "cursor rules").unwrap();
        fs::write(root.join("README.md"), "not a prompt file").unwrap();

        // Should be pruned.
        fs::create_dir_all(root.join("node_modules/pkg")).unwrap();
        fs::write(root.join("node_modules/pkg/CLAUDE.md"), "nested").unwrap();

        let found = scan_folder(root);
        let kinds: std::collections::HashSet<_> = found.iter().map(|f| f.kind.as_str()).collect();

        assert_eq!(found.len(), 3, "found: {found:#?}");
        assert!(kinds.contains("CLAUDE.md"));
        assert!(kinds.contains("AGENTS.md"));
        assert!(kinds.contains(".cursorrules"));
        assert!(!found.iter().any(|f| f.path.contains("node_modules")));
        assert!(!found.iter().any(|f| f.path.ends_with("README.md")));

        let claude = found.iter().find(|f| f.kind == "CLAUDE.md").unwrap();
        assert_eq!(claude.content, "# claude");
    }

    #[test]
    fn honors_gitignore() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::write(root.join(".gitignore"), "ignored/\n").unwrap();
        fs::write(root.join("AGENTS.md"), "root").unwrap();
        fs::create_dir_all(root.join("ignored")).unwrap();
        fs::write(root.join("ignored/CLAUDE.md"), "should be ignored").unwrap();

        let found = scan_folder(root);
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].kind, "AGENTS.md");
    }
}
