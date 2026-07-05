use std::collections::HashSet;
use std::sync::OnceLock;

use regex::Regex;

use super::line_at;
use crate::engine::{Finding, Rule, RuleContext, Severity, Source};

/// Flags `npm run X` / `pnpm run X` / `pnpm X` / `yarn run X` / `yarn X`
/// references to a script that doesn't exist in the repo's `package.json`.
/// Parses `package.json` defensively: any missing file or parse failure
/// means the rule stays silent rather than guessing.
pub struct MissingScriptReference;

/// pnpm/yarn subcommands that are never script names, so bare `pnpm X` /
/// `yarn X` invocations of these are never mistaken for a script reference.
const NON_SCRIPT_SUBCOMMANDS: &[&str] = &[
    "install", "add", "remove", "rm", "update", "upgrade", "why", "link", "unlink", "publish",
    "version", "init", "list", "ls", "outdated", "prune", "exec", "dlx", "create", "run", "config",
    "cache", "store", "import", "audit", "dedupe", "env", "setup", "i",
];

fn npm_run_pattern() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?i)\bnpm\s+run\s+([\w][\w:.-]*)").expect("valid npm run regex"))
}

fn npm_shorthand_pattern() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?i)\bnpm\s+(start|test|stop|restart)\b").expect("valid npm shorthand regex")
    })
}

fn pnpm_yarn_run_pattern() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?i)\b(?:pnpm|yarn)\s+run\s+([\w][\w:.-]*)")
            .expect("valid pnpm/yarn run regex")
    })
}

fn pnpm_yarn_bare_pattern() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?i)\b(?:pnpm|yarn)\s+([\w][\w:.-]*)").expect("valid pnpm/yarn bare regex")
    })
}

/// Extract `(match_start, script_name)` pairs for every recognized
/// script-invocation pattern in `content`.
fn candidate_scripts(content: &str) -> Vec<(usize, String)> {
    let mut out = Vec::new();
    for re in [npm_run_pattern(), pnpm_yarn_run_pattern()] {
        for cap in re.captures_iter(content) {
            let g = cap.get(1).unwrap();
            out.push((g.start(), g.as_str().to_string()));
        }
    }
    for cap in npm_shorthand_pattern().captures_iter(content) {
        let g = cap.get(1).unwrap();
        out.push((g.start(), g.as_str().to_string()));
    }
    for cap in pnpm_yarn_bare_pattern().captures_iter(content) {
        let g = cap.get(1).unwrap();
        let name = g.as_str();
        if NON_SCRIPT_SUBCOMMANDS.contains(&name.to_lowercase().as_str()) {
            continue;
        }
        out.push((g.start(), name.to_string()));
    }
    out
}

/// Parse `package.json`'s `scripts` object. Returns `None` if the file is
/// missing or can't be parsed as an object with a `scripts` object.
fn package_scripts(repo_root: &std::path::Path) -> Option<HashSet<String>> {
    let raw = std::fs::read_to_string(repo_root.join("package.json")).ok()?;
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
    fn check_ctx(&self, ctx: &RuleContext<'_>) -> Vec<Finding> {
        let Some(repo_root) = ctx.repo_root else {
            return Vec::new();
        };
        // package.json must exist at repo root for this rule to apply at all.
        if !repo_root.join("package.json").exists() {
            return Vec::new();
        }
        let Some(scripts) = package_scripts(repo_root) else {
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
            "Run `pnpm build` before committing.",
            r#"{"scripts": {"build": "vite build"}}"#,
        );
        assert!(findings.is_empty());
    }

    #[test]
    fn ignores_non_script_pnpm_subcommands() {
        let dir = tempfile::tempdir().unwrap();
        let findings = ctx_with_pkg(
            dir.path(),
            "Run `pnpm install` first.",
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
}
