//! `~/.claude/projects/<slug>` encodes the project path with `/` → `-` **and**
//! `.` → `-`. Dashes inside directory names are therefore doubly ambiguous, so
//! we resolve against the disk: at each step take the longest run of segments
//! that forms an existing dir, backtracking to shorter runs when a greedy
//! choice dead-ends.
//!
//! Deleted projects still have logs, so decoding is best-effort: the flag in
//! the return value says whether every segment was confirmed on disk.

use std::path::{Path, PathBuf};

/// Decodes `slug` into `(path, fully_resolved)`. `None` only for malformed
/// input (no leading `-`, or nothing after it).
pub fn decode_slug(slug: &str, exists: &dyn Fn(&Path) -> bool) -> Option<(PathBuf, bool)> {
    let rest = slug.strip_prefix('-')?;
    if rest.is_empty() {
        return None;
    }
    let segs: Vec<&str> = rest.split('-').collect();
    Some(resolve(Path::new("/"), &segs, exists))
}

/// Directory names a run of segments could have been encoded from, best guess
/// first. `/.claude` encodes as `--claude`, i.e. an empty leading segment, so a
/// run that starts empty is also tried with its dot put back.
fn names_for(run: &[&str]) -> Vec<String> {
    let joined = run.join("-");
    if run.len() > 1 && run[0].is_empty() {
        vec![joined, format!(".{}", run[1..].join("-"))]
    } else {
        vec![joined]
    }
}

fn resolve(base: &Path, segs: &[&str], exists: &dyn Fn(&Path) -> bool) -> (PathBuf, bool) {
    if segs.is_empty() {
        return (base.to_path_buf(), true);
    }
    // Longest run first so "clean-my-node-modules" beats "clean".
    let mut best_partial: Option<PathBuf> = None;
    for j in (1..=segs.len()).rev() {
        for name in names_for(&segs[..j]) {
            let candidate = base.join(name);
            if !exists(&candidate) {
                continue;
            }
            let (path, full) = resolve(&candidate, &segs[j..], exists);
            if full {
                return (path, true);
            }
            best_partial.get_or_insert(path);
        }
    }
    // Nothing below this point exists any more: spell the rest out naively.
    (
        best_partial.unwrap_or_else(|| base.join(segs.join("/"))),
        false,
    )
}

pub fn decode_slug_fs(slug: &str) -> Option<(PathBuf, bool)> {
    decode_slug(slug, &|p| p.is_dir())
}

/// The lossy encoding Claude Code itself applies to a project path: every `/`
/// and every `.` becomes `-`.
pub fn encode(path: &Path) -> String {
    path.to_string_lossy().replace(['/', '.'], "-")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::{Path, PathBuf};

    fn fs_with<'a>(existing: &'a [&'a str]) -> impl Fn(&Path) -> bool + 'a {
        move |p| existing.iter().any(|e| Path::new(e) == p)
    }

    #[test]
    fn encode_replaces_separators_and_dots_with_dashes() {
        assert_eq!(encode(Path::new("/Users/a/code/app")), "-Users-a-code-app");
        // Claude Code flattens '.' too, so a hidden dir loses its dot.
        assert_eq!(
            encode(Path::new("/Users/a/.claude/x")),
            "-Users-a--claude-x"
        );
    }

    /// `/.hidden` encodes as `--hidden`; the empty run tells decode to put the
    /// dot back when that is what exists on disk.
    #[test]
    fn hidden_directory_is_recovered_from_the_doubled_dash() {
        let ex = [
            "/Users",
            "/Users/a",
            "/Users/a/.claude",
            "/Users/a/.claude/worktrees",
        ];
        assert_eq!(
            decode_slug("-Users-a--claude-worktrees", &fs_with(&ex)),
            Some((PathBuf::from("/Users/a/.claude/worktrees"), true))
        );
    }

    #[test]
    fn plain_slug_maps_each_dash_to_a_separator() {
        let ex = ["/Users", "/Users/a", "/Users/a/code", "/Users/a/code/app"];
        assert_eq!(
            decode_slug("-Users-a-code-app", &fs_with(&ex)),
            Some((PathBuf::from("/Users/a/code/app"), true))
        );
    }

    #[test]
    fn dash_inside_a_directory_name_is_preserved_when_that_dir_exists() {
        let ex = [
            "/Users",
            "/Users/a",
            "/Users/a/code",
            "/Users/a/code/clean-my-node-modules",
        ];
        assert_eq!(
            decode_slug("-Users-a-code-clean-my-node-modules", &fs_with(&ex)),
            Some((PathBuf::from("/Users/a/code/clean-my-node-modules"), true))
        );
    }

    #[test]
    fn malformed_slug_returns_none() {
        assert_eq!(decode_slug("no-leading-dash", &fs_with(&["/no"])), None);
        assert_eq!(decode_slug("", &fs_with(&[])), None);
        assert_eq!(decode_slug("-", &fs_with(&[])), None);
    }

    #[test]
    fn tail_that_no_longer_exists_is_decoded_naively_and_flagged() {
        let ex = ["/Users", "/Users/a", "/Users/a/code"];
        assert_eq!(
            decode_slug("-Users-a-code-gone", &fs_with(&ex)),
            Some((PathBuf::from("/Users/a/code/gone"), false))
        );
    }

    #[test]
    fn a_greedy_run_that_dead_ends_backtracks_to_a_shorter_one() {
        // "foo-bar" exists but leads nowhere; the real path is foo/bar-baz.
        let ex = [
            "/Users",
            "/Users/a",
            "/Users/a/foo-bar",
            "/Users/a/foo",
            "/Users/a/foo/bar-baz",
        ];
        assert_eq!(
            decode_slug("-Users-a-foo-bar-baz", &fs_with(&ex)),
            Some((PathBuf::from("/Users/a/foo/bar-baz"), true))
        );
    }
}
