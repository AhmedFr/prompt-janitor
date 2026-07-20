use std::collections::HashSet;
use std::sync::OnceLock;

use regex::Regex;

use super::line_at;
use crate::engine::{Finding, Rule, RuleContext, Severity, Source};

/// Flags `npm run X` / `pnpm run X` / `yarn run X` references to a script
/// that doesn't exist in the repo's `package.json`. Deliberately narrow:
/// only matches an *explicit* `run` keyword immediately followed by the
/// script token — no bare `pnpm X` / `yarn X` heuristic, which reads far
/// too much ordinary prose ("uses pnpm for package management") as a
/// command. Parses `package.json` defensively: any missing file or parse
/// failure means the rule stays silent rather than guessing.
pub struct MissingScriptReference;

fn run_command_pattern() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?i)\b(?:npm|pnpm|yarn)\s+run\s+([\w][\w:.-]*)")
            .expect("valid run-command regex")
    })
}

/// Extract `(match_start, script_name)` pairs for every `npm|pnpm|yarn run
/// <script>` invocation in `content`.
fn candidate_scripts(content: &str) -> Vec<(usize, String)> {
    run_command_pattern()
        .captures_iter(content)
        .map(|cap| {
            let g = cap.get(1).unwrap();
            (g.start(), g.as_str().to_string())
        })
        .collect()
}

/// Parse `package.json`'s `scripts` object. Returns `None` if the file is
/// missing or can't be parsed as an object with a `scripts` object.
fn package_scripts(resolution_root: &std::path::Path) -> Option<HashSet<String>> {
    let raw = std::fs::read_to_string(resolution_root.join("package.json")).ok()?;
    let value: serde_json::Value = serde_json::from_str(&raw).ok()?;
    let scripts = value.get("scripts")?.as_object()?;
    Some(scripts.keys().cloned().collect())
}

impl Rule for MissingScriptReference {
    fn id(&self) -> &'static str {
        "missing-script-reference"
    }
    fn title(&self) -> &'static str {
        "References a script that doesn't exist"
    }
    fn source(&self) -> Source {
        Source::Custom
    }
    fn severity(&self) -> Severity {
        Severity::Mid
    }
    fn why(&self) -> &'static str {
        "The named script isn't in package.json's scripts — the agent will run it and fail."
    }
    fn dimension(&self) -> crate::engine::Dimension {
        crate::engine::Dimension::Consistency
    }
    fn check_ctx(&self, ctx: &RuleContext<'_>) -> Vec<Finding> {
        let Some(resolution_root) = ctx.resolution_root else {
            return Vec::new();
        };
        // package.json must exist at the resolution root for this rule to
        // apply at all (nearest manifest, so a monorepo package checks its
        // own package.json rather than the workspace root's).
        if !resolution_root.join("package.json").exists() {
            return Vec::new();
        }
        let Some(scripts) = package_scripts(resolution_root) else {
            return Vec::new(); // unparseable — stay silent, don't guess
        };

        let mut findings = Vec::new();
        let mut seen_lines = HashSet::new();
        for (offset, name) in candidate_scripts(ctx.content) {
            if scripts.contains(&name) {
                continue;
            }
            let line = line_at(ctx.content, offset);
            if !seen_lines.insert((line, name.clone())) {
                continue;
            }
            findings.push(Finding {
                line: Some(line),
                why: format!("No `{name}` script in package.json."),
                fix: None,
            });
        }
        findings
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn ctx_with_pkg(dir: &std::path::Path, content: &'static str, pkg: &str) -> Vec<Finding> {
        fs::write(dir.join("package.json"), pkg).unwrap();
        let ctx = RuleContext {
            content,
            file_path: None,
            repo_root: Some(dir),
            resolution_root: Some(dir),
            modified_unix: None,
        };
        MissingScriptReference.check_ctx(&ctx)
    }

    #[test]
    fn flags_missing_npm_run_script() {
        let dir = tempfile::tempdir().unwrap();
        let findings = ctx_with_pkg(
            dir.path(),
            "Run `npm run typecheck` before committing.",
            r#"{"scripts": {"build": "vite build"}}"#,
        );
        assert_eq!(findings.len(), 1);
    }

    #[test]
    fn accepts_existing_script() {
        let dir = tempfile::tempdir().unwrap();
        let findings = ctx_with_pkg(
            dir.path(),
            "Run `pnpm run build` before committing.",
            r#"{"scripts": {"build": "vite build"}}"#,
        );
        assert!(findings.is_empty());
    }

    #[test]
    fn skips_when_package_json_missing() {
        let dir = tempfile::tempdir().unwrap();
        let ctx = RuleContext {
            content: "Run `npm run typecheck`.",
            file_path: None,
            repo_root: Some(dir.path()),
            resolution_root: Some(dir.path()),
            modified_unix: None,
        };
        assert!(MissingScriptReference.check_ctx(&ctx).is_empty());
    }

    #[test]
    fn skips_when_package_json_unparseable() {
        let dir = tempfile::tempdir().unwrap();
        let findings = ctx_with_pkg(dir.path(), "Run `npm run typecheck`.", "not json");
        assert!(findings.is_empty());
    }

    #[test]
    fn does_not_fire_without_repo_root() {
        let ctx = RuleContext::content_only("Run `npm run typecheck`.");
        assert!(MissingScriptReference.check_ctx(&ctx).is_empty());
    }

    // Adversarial-review repros (#92): prose mentioning a package manager by
    // name must never be mistaken for a command invocation.
    #[test]
    fn ignores_prose_about_package_manager_choice() {
        let dir = tempfile::tempdir().unwrap();
        for prose in [
            "This project uses pnpm for package management.",
            "Always use pnpm and never npm in this repo.",
            "We standardized on Yarn for this monorepo.",
            "This repo is managed with pnpm workspaces.",
        ] {
            fs::write(
                dir.path().join("package.json"),
                r#"{"scripts": {"build": "x"}}"#,
            )
            .unwrap();
            let ctx = RuleContext {
                content: prose,
                file_path: None,
                repo_root: Some(dir.path()),
                resolution_root: Some(dir.path()),
                modified_unix: None,
            };
            assert!(
                MissingScriptReference.check_ctx(&ctx).is_empty(),
                "false positive on: {prose}"
            );
        }
    }

    #[test]
    fn ignores_run_keyword_separated_from_manager_by_a_subcommand() {
        let dir = tempfile::tempdir().unwrap();
        // Empty scripts: if anything were (wrongly) extracted from this
        // command, it would fire.
        let findings = ctx_with_pkg(
            dir.path(),
            "Run `yarn workspace api-worker run build`.",
            r#"{"scripts": {}}"#,
        );
        assert!(findings.is_empty());
    }

    // Monorepo resolution base (#92): a script defined only in the nested
    // package's package.json must resolve when the instruction file lives
    // in that package.
    #[test]
    fn resolves_scripts_against_nearest_package_in_a_monorepo() {
        let dir = tempfile::tempdir().unwrap();
        git2::Repository::init(dir.path()).unwrap();
        fs::write(dir.path().join("package.json"), r#"{"scripts": {}}"#).unwrap();
        fs::create_dir_all(dir.path().join("packages/api")).unwrap();
        fs::write(
            dir.path().join("packages/api/package.json"),
            r#"{"scripts": {"migrate": "node migrate.js"}}"#,
        )
        .unwrap();
        let file = dir.path().join("packages/api/CLAUDE.md");
        fs::write(&file, "Run `pnpm run migrate` before deploying.").unwrap();

        let resolution_root = crate::repo_root::resolution_root(&file).unwrap();
        let ctx = RuleContext {
            content: "Run `pnpm run migrate` before deploying.",
            file_path: Some(&file),
            repo_root: Some(dir.path()),
            resolution_root: Some(&resolution_root),
            modified_unix: None,
        };
        assert!(MissingScriptReference.check_ctx(&ctx).is_empty());
    }
}
