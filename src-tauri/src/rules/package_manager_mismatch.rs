use std::sync::OnceLock;

use regex::Regex;

use super::{line_at, line_text};
use crate::engine::{Finding, Fix, Rule, RuleContext, Severity, Source};

/// Flags instructions that name a package manager other than the one this
/// repo actually uses (inferred from which lockfile is present). Fires only
/// when exactly one lockfile family exists, so an ambiguous or unlockfiled
/// repo never gets a false positive.
pub struct PackageManagerMismatch;

/// (lockfile filename, package-manager name it implies).
const LOCKFILES: &[(&str, &str)] = &[
    ("pnpm-lock.yaml", "pnpm"),
    ("package-lock.json", "npm"),
    ("yarn.lock", "yarn"),
    ("bun.lockb", "bun"),
    ("bun.lock", "bun"),
];

fn command_pattern() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?i)\b(npm|yarn|pnpm|bun)\s+(?:run\s+)?(?:install|ci|add|remove|exec|dlx|test|build|start|i)\b")
            .expect("valid package manager command regex")
    })
}

/// The single package manager this repo's lockfile implies, or `None` if
/// zero or more than one lockfile family is present.
fn detect_manager(repo_root: &std::path::Path) -> Option<&'static str> {
    let mut found = None;
    for (file, manager) in LOCKFILES {
        if repo_root.join(file).exists() {
            if found.is_some() && found != Some(*manager) {
                return None; // more than one family — ambiguous, don't guess
            }
            found = Some(*manager);
        }
    }
    found
}

impl Rule for PackageManagerMismatch {
    fn id(&self) -> &'static str {
        "package-manager-mismatch"
    }
    fn title(&self) -> &'static str {
        "Wrong package manager"
    }
    fn source(&self) -> Source {
        Source::Custom
    }
    fn severity(&self) -> Severity {
        Severity::Hi
    }
    fn why(&self) -> &'static str {
        "The instruction names a package manager this repo doesn't use — checked against the lockfile actually on disk."
    }
    fn check_ctx(&self, ctx: &RuleContext<'_>) -> Vec<Finding> {
        let Some(repo_root) = ctx.repo_root else {
            return Vec::new();
        };
        let Some(actual) = detect_manager(repo_root) else {
            return Vec::new(); // no lockfile, or ambiguous — don't guess
        };

        let mut findings = Vec::new();
        for cap in command_pattern().captures_iter(ctx.content) {
            let named = cap.get(1).unwrap();
            let manager = named.as_str().to_lowercase();
            if manager == actual {
                continue;
            }
            let line = line_at(ctx.content, named.start());
            findings.push(Finding {
                line: Some(line),
                why: format!("Instructs `{manager}` but this repo has only a {actual}-lock file."),
                fix: Some(Fix {
                    from: line_text(ctx.content, line).trim().to_string(),
                    to: format!("Use {actual} instead of {manager}."),
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
    fn flags_npm_when_repo_is_pnpm_only() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("pnpm-lock.yaml"), "").unwrap();
        let ctx = RuleContext {
            content: "Run `npm install` to set up.",
            file_path: None,
            repo_root: Some(dir.path()),
            modified_unix: None,
        };
        let findings = PackageManagerMismatch.check_ctx(&ctx);
        assert_eq!(findings.len(), 1);
    }

    #[test]
    fn accepts_matching_manager() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("pnpm-lock.yaml"), "").unwrap();
        let ctx = RuleContext {
            content: "Run pnpm install to set up.",
            file_path: None,
            repo_root: Some(dir.path()),
            modified_unix: None,
        };
        assert!(PackageManagerMismatch.check_ctx(&ctx).is_empty());
    }

    #[test]
    fn skips_when_multiple_lockfiles_present() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("pnpm-lock.yaml"), "").unwrap();
        fs::write(dir.path().join("yarn.lock"), "").unwrap();
        let ctx = RuleContext {
            content: "Run npm install to set up.",
            file_path: None,
            repo_root: Some(dir.path()),
            modified_unix: None,
        };
        assert!(PackageManagerMismatch.check_ctx(&ctx).is_empty());
    }

    #[test]
    fn skips_when_no_lockfile() {
        let dir = tempfile::tempdir().unwrap();
        let ctx = RuleContext {
            content: "Run npm install to set up.",
            file_path: None,
            repo_root: Some(dir.path()),
            modified_unix: None,
        };
        assert!(PackageManagerMismatch.check_ctx(&ctx).is_empty());
    }

    #[test]
    fn does_not_fire_without_repo_root() {
        let ctx = RuleContext::content_only("Run npm install to set up.");
        assert!(PackageManagerMismatch.check_ctx(&ctx).is_empty());
    }
}
