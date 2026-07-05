use std::sync::OnceLock;

use regex::Regex;

use super::{line_at, line_text};
use crate::engine::{Finding, Fix, Rule, RuleContext, Severity, Source};

/// Flags backtick-quoted, path-shaped references to files that don't exist
/// in the repo. Zero-FP by construction: only backtick spans are considered
/// (never bare prose), and only spans that already look like a relative
/// path (a dirname prefix or a file extension) with no glob/URL/template
/// markers are resolved against the repo root.
pub struct DeadFileReference;

/// Directory prefixes that make a bare word "look like a path" even without
/// an extension (e.g. `scripts/build`).
const KNOWN_DIR_PREFIXES: &[&str] = &[
    "src/",
    "scripts/",
    "docs/",
    "lib/",
    "test/",
    "tests/",
    "bin/",
    "config/",
    "app/",
    "packages/",
    "crates/",
    "assets/",
    "public/",
    ".github/",
];

fn backtick_span() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"`([^`\n]+)`").expect("valid backtick regex"))
}

/// Does `candidate` look like a checkable relative file path, as opposed to
/// a command, a glob, a URL, or a placeholder?
fn looks_like_path(candidate: &str) -> bool {
    if candidate.is_empty() || candidate.contains(char::is_whitespace) {
        return false; // commands / prose, not a bare path
    }
    if candidate.contains("://") || candidate.starts_with("www.") {
        return false; // URL
    }
    if candidate.contains(['*', '?', '<', '>', '{', '}', '$']) {
        return false; // glob, placeholder, or template var
    }
    if candidate.starts_with('/') || candidate.starts_with('~') {
        return false; // absolute / home-relative — out of scope, avoid FPs
    }
    if candidate.starts_with('#') || candidate.starts_with('.') && !candidate.starts_with("./") {
        return false; // markdown anchors, dotfiles-as-flags, etc.
    }

    if !candidate.contains('/') {
        return false; // require an actual relative path, not a bare filename
    }

    let has_known_prefix = KNOWN_DIR_PREFIXES.iter().any(|p| candidate.starts_with(p));
    let has_extension = candidate
        .rsplit('/')
        .next()
        .map(|last| last.contains('.') && !last.starts_with('.') && !last.ends_with('.'))
        .unwrap_or(false);

    has_known_prefix || has_extension
}

impl Rule for DeadFileReference {
    fn id(&self) -> &'static str {
        "dead-file-reference"
    }
    fn title(&self) -> &'static str {
        "Reference to a file that doesn't exist"
    }
    fn source(&self) -> Source {
        Source::Custom
    }
    fn severity(&self) -> Severity {
        Severity::Hi
    }
    fn why(&self) -> &'static str {
        "A path the agent can't find sends it hunting or hallucinating a substitute — checked against the repo on disk."
    }
    fn check_ctx(&self, ctx: &RuleContext<'_>) -> Vec<Finding> {
        let Some(repo_root) = ctx.repo_root else {
            return Vec::new(); // no repo context — can't verify, don't guess
        };
        let mut findings = Vec::new();
        for cap in backtick_span().captures_iter(ctx.content) {
            let m = cap.get(1).unwrap();
            let candidate = m.as_str();
            if !looks_like_path(candidate) {
                continue;
            }
            let stripped = candidate.strip_prefix("./").unwrap_or(candidate);
            if repo_root.join(stripped).exists() {
                continue;
            }
            let line = line_at(ctx.content, m.start());
            findings.push(Finding {
                line: Some(line),
                why: format!("`{candidate}` doesn't exist in this repo."),
                fix: Some(Fix {
                    from: line_text(ctx.content, line).trim().to_string(),
                    to: "Point at a path that actually exists, or remove the reference."
                        .to_string(),
                }),
            });
        }
        findings
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn flags_missing_backtick_path() {
        let dir = tempfile::tempdir().unwrap();
        let ctx = RuleContext {
            content: "See `src/foo.ts` for details.",
            file_path: None,
            repo_root: Some(dir.path()),
            modified_unix: None,
        };
        let findings = DeadFileReference.check_ctx(&ctx);
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].line, Some(1));
    }

    #[test]
    fn accepts_existing_path() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir_all(dir.path().join("src")).unwrap();
        fs::write(dir.path().join("src/foo.ts"), "").unwrap();
        let ctx = RuleContext {
            content: "See `src/foo.ts` for details.",
            file_path: None,
            repo_root: Some(dir.path()),
            modified_unix: None,
        };
        assert!(DeadFileReference.check_ctx(&ctx).is_empty());
    }

    #[test]
    fn ignores_globs_urls_and_placeholders() {
        let dir = tempfile::tempdir().unwrap();
        let content = "Run `src/**/*.ts`, see `https://example.com/src/foo.ts`, edit `<file>` and `{{path}}`.";
        let ctx = RuleContext {
            content,
            file_path: None,
            repo_root: Some(dir.path()),
            modified_unix: None,
        };
        assert!(DeadFileReference.check_ctx(&ctx).is_empty());
    }

    #[test]
    fn ignores_commands_in_backticks() {
        let dir = tempfile::tempdir().unwrap();
        let ctx = RuleContext {
            content: "Run `pnpm install` first.",
            file_path: None,
            repo_root: Some(dir.path()),
            modified_unix: None,
        };
        assert!(DeadFileReference.check_ctx(&ctx).is_empty());
    }

    #[test]
    fn does_not_fire_without_repo_root() {
        let ctx = RuleContext::content_only("See `src/missing.ts` for details.");
        assert!(DeadFileReference.check_ctx(&ctx).is_empty());
    }
}
