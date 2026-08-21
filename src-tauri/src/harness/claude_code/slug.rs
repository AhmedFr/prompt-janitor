//! `~/.claude/projects/<slug>` encodes the project path with `/` → `-`.
//! Dashes inside directory names are ambiguous, so we resolve greedily:
//! at each step take the longest run of segments that forms an existing dir.

use std::path::{Path, PathBuf};

pub fn decode_slug(slug: &str, exists: &dyn Fn(&Path) -> bool) -> Option<PathBuf> {
    let rest = slug.strip_prefix('-')?;
    let segs: Vec<&str> = rest.split('-').collect();
    let mut path = PathBuf::from("/");
    let mut i = 0;
    while i < segs.len() {
        // Try the longest candidate first so "clean-my-node-modules" beats "clean".
        let mut matched = None;
        for j in (i + 1..=segs.len()).rev() {
            let candidate = path.join(segs[i..j].join("-"));
            if exists(&candidate) {
                matched = Some((candidate, j));
                break;
            }
        }
        let (next, j) = matched?;
        path = next;
        i = j;
    }
    Some(path)
}

pub fn decode_slug_fs(slug: &str) -> Option<PathBuf> {
    decode_slug(slug, &|p| p.is_dir())
}

pub fn encode(path: &Path) -> String {
    path.to_string_lossy().replace('/', "-")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::{Path, PathBuf};

    fn fs_with<'a>(existing: &'a [&'a str]) -> impl Fn(&Path) -> bool + 'a {
        move |p| existing.iter().any(|e| Path::new(e) == p)
    }

    #[test]
    fn encode_replaces_separators_with_dashes() {
        assert_eq!(encode(Path::new("/Users/a/code/app")), "-Users-a-code-app");
    }

    #[test]
    fn plain_slug_maps_each_dash_to_a_separator() {
        let ex = ["/Users", "/Users/a", "/Users/a/code", "/Users/a/code/app"];
        assert_eq!(
            decode_slug("-Users-a-code-app", &fs_with(&ex)),
            Some(PathBuf::from("/Users/a/code/app"))
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
            Some(PathBuf::from("/Users/a/code/clean-my-node-modules"))
        );
    }

    #[test]
    fn unresolvable_slug_returns_none() {
        assert_eq!(decode_slug("-nope-x", &fs_with(&["/Users"])), None);
        assert_eq!(decode_slug("no-leading-dash", &fs_with(&["/no"])), None);
    }
}
