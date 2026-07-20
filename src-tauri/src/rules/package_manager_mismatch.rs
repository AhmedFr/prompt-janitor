use std::path::Path;
use std::sync::OnceLock;

use regex::Regex;

use super::{line_at, line_text, negated_nearby};
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

/// How many words back on the same line to look for a negation cue
/// ("don't run npm install") before treating a command mention as an
/// instruction rather than a prohibition.
const NEGATION_WINDOW: usize = 4;

fn command_pattern() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?i)\b(npm|yarn|pnpm|bun)\s+(?:run\s+)?(?:install|ci|add|remove|exec|dlx|test|build|start|i)\b")
            .expect("valid package manager command regex")
    })
}

/// What a directory's lockfiles imply about its package manager.
enum LockfileSignal {
    /// Exactly one lockfile family present.
    Single(&'static str),
    /// More than one lockfile family present — don't guess.
    Ambiguous,
    /// No recognized lockfile present.
    None,
}

fn lockfile_signal(root: &Path) -> LockfileSignal {
    let mut found = None;
    for (file, manager) in LOCKFILES {
        if root.join(file).exists() {
            if found.is_some() && found != Some(*manager) {
                return LockfileSignal::Ambiguous;
            }
            found = Some(*manager);
        }
    }
    match found {
        Some(m) => LockfileSignal::Single(m),
        None => LockfileSignal::None,
    }
}

/// The single package manager this repo uses, checked at the nearest
/// manifest (monorepo package) first, falling back to the git root's
/// lockfiles when the package level has none at all. An ambiguous result at
/// either level stops the search rather than guessing further.
fn detect_manager(ctx: &RuleContext<'_>) -> Option<&'static str> {
    if let Some(resolution_root) = ctx.resolution_root {
        match lockfile_signal(resolution_root) {
            LockfileSignal::Single(m) => return Some(m),
            LockfileSignal::Ambiguous => return None,
            LockfileSignal::None => {} // fall through to the git root's lockfiles
        }
    }
    match ctx.repo_root {
        Some(repo_root) => match lockfile_signal(repo_root) {
            LockfileSignal::Single(m) => Some(m),
            LockfileSignal::Ambiguous | LockfileSignal::None => None,
        },
        None => None,
    }
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
    fn dimension(&self) -> crate::engine::Dimension {
        crate::engine::Dimension::Consistency
    }
    fn check_ctx(&self, ctx: &RuleContext<'_>) -> Vec<Finding> {
        let Some(actual) = detect_manager(ctx) else {
            return Vec::new(); // no lockfile, or ambiguous — don't guess
        };

        let mut findings = Vec::new();
        for cap in command_pattern().captures_iter(ctx.content) {
            let named = cap.get(1).unwrap();
            let manager = named.as_str().to_lowercase();
            if manager == actual {
                continue;
            }
            if negated_nearby(ctx.content, named.start(), NEGATION_WINDOW) {
                continue; // "don't run npm install" names it to forbid it, not to instruct it
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
            resolution_root: Some(dir.path()),
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
            resolution_root: Some(dir.path()),
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
            resolution_root: Some(dir.path()),
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
            resolution_root: Some(dir.path()),
            modified_unix: None,
        };
        assert!(PackageManagerMismatch.check_ctx(&ctx).is_empty());
    }

    #[test]
    fn does_not_fire_without_repo_root() {
        let ctx = RuleContext::content_only("Run npm install to set up.");
        assert!(PackageManagerMismatch.check_ctx(&ctx).is_empty());
    }

    // Adversarial-review repro (#92): naming the wrong manager to forbid it
    // is not an instruction to use it.
    #[test]
    fn ignores_negated_mention() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("pnpm-lock.yaml"), "").unwrap();
        let ctx = RuleContext {
            content: "Don't run npm install — use pnpm install instead.",
            file_path: None,
            repo_root: Some(dir.path()),
            resolution_root: Some(dir.path()),
            modified_unix: None,
        };
        assert!(PackageManagerMismatch.check_ctx(&ctx).is_empty());
    }

    // Monorepo resolution base (#92): a script/lockfile defined only in a
    // nested package should be resolved from that package first.
    #[test]
    fn falls_back_to_git_root_lockfiles_when_package_has_none() {
        let dir = tempfile::tempdir().unwrap();
        git2::Repository::init(dir.path()).unwrap();
        fs::write(dir.path().join("pnpm-lock.yaml"), "").unwrap();
        fs::create_dir_all(dir.path().join("packages/api")).unwrap();
        fs::write(dir.path().join("packages/api/package.json"), "{}").unwrap();
        let ctx = RuleContext {
            content: "Run npm install to set up.",
            file_path: None,
            repo_root: Some(dir.path()),
            resolution_root: Some(&dir.path().join("packages/api")),
            modified_unix: None,
        };
        let findings = PackageManagerMismatch.check_ctx(&ctx);
        assert_eq!(findings.len(), 1);
    }
}
