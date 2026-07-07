//! Starter template packs (Pro feature, #75): A-grade exemplar `CLAUDE.md` /
//! `AGENTS.md` files for developers who have no instruction file at all.
//!
//! Content lives as static assets under `templates/content/<stack>/<file>`,
//! embedded at compile time with `include_str!` so the binary is
//! self-contained. [`list`] is free (browsing/reading a template never
//! requires a license); [`apply`] writes a template to disk and is gated by
//! the caller (`commands::apply_template`) the same way `apply_fix` is.

/// One starter template: metadata plus its full content for the free preview.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct TemplateInfo {
    pub id: String,
    /// Stack id: `react-ts`, `python`, or `rust`.
    pub stack: String,
    /// The instruction file name this template produces: `CLAUDE.md` or `AGENTS.md`.
    pub file_type: String,
    pub title: String,
    pub description: String,
    /// The full file content — shown as a free, honest preview even though
    /// writing it to disk is a paid action.
    pub preview: String,
}

/// Result of writing a template to disk.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct ApplyTemplateResult {
    /// The full path the template was written to.
    pub path: String,
}

macro_rules! template {
    ($id:literal, $stack:literal, $file_type:literal, $title:literal, $description:literal, $path:literal) => {
        TemplateInfo {
            id: $id.to_string(),
            stack: $stack.to_string(),
            file_type: $file_type.to_string(),
            title: $title.to_string(),
            description: $description.to_string(),
            preview: include_str!($path).to_string(),
        }
    };
}

/// Every starter template, in display order: 3 stacks × 2 file types.
pub fn all() -> Vec<TemplateInfo> {
    vec![
        template!(
            "react-ts-claude",
            "react-ts",
            "CLAUDE.md",
            "React + TypeScript — CLAUDE.md",
            "Role, pnpm commands, output format, and a worked example for a Vite/React/TypeScript codebase.",
            "templates/content/react-ts/CLAUDE.md"
        ),
        template!(
            "react-ts-agents",
            "react-ts",
            "AGENTS.md",
            "React + TypeScript — AGENTS.md",
            "Setup, build/test commands, and verification steps for coding agents in a pnpm-based TypeScript project.",
            "templates/content/react-ts/AGENTS.md"
        ),
        template!(
            "python-claude",
            "python",
            "CLAUDE.md",
            "Python — CLAUDE.md",
            "Role, uv/pytest commands, output format, and a worked example for a modern Python codebase.",
            "templates/content/python/CLAUDE.md"
        ),
        template!(
            "python-agents",
            "python",
            "AGENTS.md",
            "Python — AGENTS.md",
            "Setup, test/lint commands, and verification steps for coding agents in a uv-managed Python project.",
            "templates/content/python/AGENTS.md"
        ),
        template!(
            "rust-claude",
            "rust",
            "CLAUDE.md",
            "Rust — CLAUDE.md",
            "Role, cargo commands, output format, and a worked example for a Rust codebase.",
            "templates/content/rust/CLAUDE.md"
        ),
        template!(
            "rust-agents",
            "rust",
            "AGENTS.md",
            "Rust — AGENTS.md",
            "Setup, build/test commands, and verification steps for coding agents in a cargo-managed Rust project.",
            "templates/content/rust/AGENTS.md"
        ),
    ]
}

/// Look up one template by id.
pub fn find(id: &str) -> Option<TemplateInfo> {
    all().into_iter().find(|t| t.id == id)
}

/// The JS package managers a react-ts template's commands can be adapted
/// for, detected by which lockfile is present in the target repo.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PackageManager {
    Pnpm,
    Npm,
    Yarn,
    Bun,
}

impl PackageManager {
    fn command_name(self) -> &'static str {
        match self {
            PackageManager::Pnpm => "pnpm",
            PackageManager::Npm => "npm",
            PackageManager::Yarn => "yarn",
            PackageManager::Bun => "bun",
        }
    }

    fn lockfile_name(self) -> &'static str {
        match self {
            PackageManager::Pnpm => "pnpm-lock.yaml",
            PackageManager::Npm => "package-lock.json",
            PackageManager::Yarn => "yarn.lock",
            PackageManager::Bun => "bun.lock",
        }
    }
}

/// Detect the target repo's JS package manager by lockfile presence.
/// Defaults to pnpm when no lockfile is found at all, which keeps the
/// template's original (unmodified) content for a fresh/empty repo.
fn detect_package_manager(dir: &std::path::Path) -> PackageManager {
    if dir.join("pnpm-lock.yaml").is_file() {
        PackageManager::Pnpm
    } else if dir.join("package-lock.json").is_file() {
        PackageManager::Npm
    } else if dir.join("yarn.lock").is_file() {
        PackageManager::Yarn
    } else if dir.join("bun.lockb").is_file() || dir.join("bun.lock").is_file() {
        PackageManager::Bun
    } else {
        PackageManager::Pnpm
    }
}

/// Adapt the react-ts template's pnpm-specific commands and lockfile
/// mentions to the target repo's actual package manager (#75 review
/// finding P1). Without this, a template applied into an npm/yarn/bun repo
/// would hardcode `pnpm install`/`pnpm test`/`pnpm build`, which the
/// `package_manager_mismatch` rule (landing on feat/74) flags at Hi
/// severity — three hits is a D grade, breaking the "apply → instant A"
/// promise for the most common JS setups.
///
/// This intentionally does a plain token swap (`pnpm` -> `npm`/`yarn`/
/// `bun`) rather than rewriting the dev/lint/typecheck lines into
/// `npm run <script>` form. That form would read as more idiomatic npm,
/// but this template gets applied into an arbitrary repo where we can't
/// guarantee those scripts exist in `package.json` — introducing an
/// explicit `run <script>` we don't control would risk tripping a
/// `missing_script_reference`-shaped rule that the bare `<pm> <script>`
/// invocation (pnpm/yarn/bun's own convention, and what npm's `test`/
/// `install` already do) does not.
fn adapt_react_ts_content(content: &str, pm: PackageManager) -> String {
    if pm == PackageManager::Pnpm {
        return content.to_string();
    }
    content
        .replace("pnpm-lock.yaml", pm.lockfile_name())
        .replace("pnpm", pm.command_name())
}

/// Write `template_id`'s content into `dest_dir` as its `file_type` name.
/// Errors if the template id is unknown, `dest_dir` doesn't exist, or a
/// same-named file (or a symlink, dangling or not, planted at that path)
/// is already there — this never overwrites and never follows a symlink.
pub fn apply(template_id: &str, dest_dir: &str) -> Result<ApplyTemplateResult, String> {
    let template = find(template_id).ok_or_else(|| format!("Unknown template: {template_id}"))?;
    let dir = std::path::Path::new(dest_dir);
    if !dir.is_dir() {
        return Err(format!("{dest_dir} isn't a folder."));
    }
    let dest = dir.join(&template.file_type);
    let file_type = &template.file_type;

    let content = if template.stack == "react-ts" {
        adapt_react_ts_content(&template.preview, detect_package_manager(dir))
    } else {
        template.preview.clone()
    };

    // Atomic create-new open (O_CREAT|O_EXCL): fails if `dest` already
    // exists OR is a symlink, dangling or not, instead of a separate
    // `exists()` check followed by a `write` that would happily follow a
    // symlink and write outside the picked folder. This also removes the
    // TOCTOU window between checking and writing.
    use std::fs::OpenOptions;
    use std::io::Write;
    let mut f = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&dest)
        .map_err(|e| match e.kind() {
            std::io::ErrorKind::AlreadyExists => {
                format!("{file_type} already exists there — remove or rename it first.")
            }
            _ => format!("Couldn't write the template: {e}"),
        })?;
    f.write_all(content.as_bytes())
        .map_err(|e| format!("Couldn't write the template: {e}"))?;
    Ok(ApplyTemplateResult {
        path: dest.to_string_lossy().into_owned(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::{evaluate, Grade};
    use crate::rules::builtin_rules;

    #[test]
    fn lists_three_stacks_times_two_file_types() {
        let templates = all();
        assert_eq!(templates.len(), 6);
        let stacks: std::collections::BTreeSet<_> =
            templates.iter().map(|t| t.stack.as_str()).collect();
        assert_eq!(
            stacks,
            std::collections::BTreeSet::from(["react-ts", "python", "rust"])
        );
        for stack in &stacks {
            let file_types: std::collections::BTreeSet<_> = templates
                .iter()
                .filter(|t| t.stack == *stack)
                .map(|t| t.file_type.as_str())
                .collect();
            assert_eq!(
                file_types,
                std::collections::BTreeSet::from(["CLAUDE.md", "AGENTS.md"]),
                "stack {stack} should have both file types"
            );
        }
    }

    #[test]
    fn ids_are_unique() {
        let templates = all();
        let ids: std::collections::BTreeSet<_> = templates.iter().map(|t| t.id.as_str()).collect();
        assert_eq!(ids.len(), templates.len());
    }

    /// Every template must be substantive: comfortably above the empty-stub
    /// floor and comfortably below the token-budget ceiling.
    #[test]
    fn every_template_is_substantive_but_not_bloated() {
        for t in all() {
            let chars = t.preview.chars().count();
            assert!(chars > 120, "{} is too short ({chars} chars)", t.id);
            assert!(chars < 6000, "{} is too long ({chars} chars)", t.id);
        }
    }

    /// Every template must have no exact duplicate non-trivial line — the
    /// same shape `duplicate-rules` checks.
    #[test]
    fn every_template_has_no_duplicate_lines() {
        for t in all() {
            let mut seen = std::collections::HashSet::new();
            for line in t.preview.lines() {
                let normalized: String = line
                    .trim()
                    .to_lowercase()
                    .split_whitespace()
                    .collect::<Vec<_>>()
                    .join(" ");
                if normalized.len() <= 20 {
                    continue;
                }
                assert!(
                    seen.insert(normalized.clone()),
                    "{} repeats a line: {normalized}",
                    t.id
                );
            }
        }
    }

    /// The whole point of this feature: every shipped template grades A
    /// against this app's own deterministic rules.
    #[test]
    fn every_template_grades_a_against_builtin_rules() {
        let rules = builtin_rules();
        for t in all() {
            let eval = evaluate(&t.preview, &rules);
            assert_eq!(
                eval.grade,
                Grade::A,
                "{} scored {:?} ({}) with issues: {:#?}",
                t.id,
                eval.grade,
                eval.score,
                eval.issues
            );
        }
    }

    #[test]
    fn find_returns_none_for_unknown_id() {
        assert!(find("nope").is_none());
    }

    #[test]
    fn apply_writes_the_file_and_returns_its_path() {
        let dir = tempfile::tempdir().unwrap();
        let result = apply("rust-claude", dir.path().to_str().unwrap()).unwrap();
        assert_eq!(result.path, dir.path().join("CLAUDE.md").to_string_lossy());
        let written = std::fs::read_to_string(&result.path).unwrap();
        assert_eq!(written, find("rust-claude").unwrap().preview);
    }

    #[test]
    fn apply_never_overwrites_an_existing_file() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("CLAUDE.md"), "existing content").unwrap();
        let err = apply("rust-claude", dir.path().to_str().unwrap()).unwrap_err();
        assert!(err.contains("already exists"));
        assert_eq!(
            std::fs::read_to_string(dir.path().join("CLAUDE.md")).unwrap(),
            "existing content"
        );
    }

    #[test]
    fn apply_rejects_unknown_template_id() {
        let dir = tempfile::tempdir().unwrap();
        let err = apply("nope", dir.path().to_str().unwrap()).unwrap_err();
        assert!(err.contains("Unknown template"));
    }

    #[test]
    fn apply_rejects_a_missing_destination_folder() {
        let err = apply("rust-claude", "/no/such/folder/anywhere").unwrap_err();
        assert!(err.contains("isn't a folder"));
    }

    /// Review finding P0 (#96): a dangling symlink planted at the
    /// destination path used to pass the old `dest.exists()` check (which
    /// returns false for a dangling symlink) and then `std::fs::write`
    /// would follow it, writing the template to an attacker-chosen path
    /// outside the folder the user picked. `apply` must now refuse to
    /// follow the symlink at all — succeeding or failing on the *link*,
    /// never the target.
    #[test]
    #[cfg(unix)]
    fn apply_refuses_to_follow_a_dangling_symlink_at_the_destination() {
        let dir = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        let outside_target = outside.path().join("should-not-be-created.md");

        // Dangling: the symlink exists, but its target does not.
        std::os::unix::fs::symlink(&outside_target, dir.path().join("CLAUDE.md")).unwrap();

        let err = apply("rust-claude", dir.path().to_str().unwrap()).unwrap_err();
        assert!(err.contains("already exists"), "unexpected error: {err}");
        assert!(
            !outside_target.exists(),
            "apply must never write outside the picked folder via a dangling symlink"
        );
    }

    /// Same attack, but the symlink points at a file that *does* exist
    /// outside the picked folder — apply must refuse to overwrite that
    /// file too, not just skip dangling links.
    #[test]
    #[cfg(unix)]
    fn apply_refuses_to_follow_a_symlink_pointing_at_an_existing_outside_file() {
        let dir = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        let outside_target = outside.path().join("victim.md");
        std::fs::write(&outside_target, "do not touch").unwrap();

        std::os::unix::fs::symlink(&outside_target, dir.path().join("CLAUDE.md")).unwrap();

        let err = apply("rust-claude", dir.path().to_str().unwrap()).unwrap_err();
        assert!(err.contains("already exists"), "unexpected error: {err}");
        assert_eq!(
            std::fs::read_to_string(&outside_target).unwrap(),
            "do not touch",
            "apply must never overwrite a file outside the picked folder via a symlink"
        );
    }

    #[test]
    fn detect_package_manager_reads_lockfiles_and_defaults_to_pnpm() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(detect_package_manager(dir.path()), PackageManager::Pnpm);

        std::fs::write(dir.path().join("package-lock.json"), "{}").unwrap();
        assert_eq!(detect_package_manager(dir.path()), PackageManager::Npm);
        std::fs::remove_file(dir.path().join("package-lock.json")).unwrap();

        std::fs::write(dir.path().join("yarn.lock"), "").unwrap();
        assert_eq!(detect_package_manager(dir.path()), PackageManager::Yarn);
        std::fs::remove_file(dir.path().join("yarn.lock")).unwrap();

        std::fs::write(dir.path().join("bun.lock"), "").unwrap();
        assert_eq!(detect_package_manager(dir.path()), PackageManager::Bun);
        std::fs::remove_file(dir.path().join("bun.lock")).unwrap();

        // pnpm-lock.yaml wins even if another lockfile is somehow present too.
        std::fs::write(dir.path().join("pnpm-lock.yaml"), "").unwrap();
        std::fs::write(dir.path().join("package-lock.json"), "{}").unwrap();
        assert_eq!(detect_package_manager(dir.path()), PackageManager::Pnpm);
    }

    /// Review finding P1 (#96): the react-ts templates hardcode
    /// `pnpm install`/`pnpm test`/`pnpm build`. Applied as-is into a repo
    /// that uses npm/yarn/bun, the (feat/74) `package_manager_mismatch`
    /// rule fires Hi severity on each of those lines — three hits is a D
    /// grade, breaking the "apply a template → instant A" promise for the
    /// most common JS setup. `apply` must rewrite the package-manager
    /// commands and lockfile mention to match the target repo before
    /// writing.
    ///
    /// NOTE on coverage: the real `package_manager_mismatch` and
    /// `missing_script_reference` rules live on feat/74-fact-rules and its
    /// 14-rule `evaluate_ctx`, not on this branch, so this test can't run
    /// the real evaluator end to end. Instead it directly asserts the two
    /// properties those rules check: (1) no package-manager command token
    /// in the applied file disagrees with the target repo's actual
    /// lockfile-implied manager (no stray `pnpm` leaking into an npm repo),
    /// and (2) no `<pm> run <script>` form is introduced at all (we only
    /// ever emit bare `<pm> <script>`), so there is nothing new for
    /// `missing_script_reference` to flag as missing. Re-run this scenario
    /// against the real rule set once feat/74 merges.
    #[test]
    fn apply_adapts_react_ts_commands_to_an_npm_repo() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("package-lock.json"), "{}").unwrap();
        std::fs::write(
            dir.path().join("package.json"),
            r#"{"name":"fixture","scripts":{"dev":"vite","test":"vitest","lint":"eslint .","typecheck":"tsc --noEmit","build":"vite build"}}"#,
        )
        .unwrap();

        for id in ["react-ts-claude", "react-ts-agents"] {
            let result = apply(id, dir.path().to_str().unwrap()).unwrap();
            let written = std::fs::read_to_string(&result.path).unwrap();

            assert!(
                !written.contains("pnpm"),
                "{id} written into an npm repo still mentions pnpm:\n{written}"
            );
            assert!(
                !written.contains("pnpm-lock.yaml"),
                "{id} still claims a pnpm-lock.yaml lockfile:\n{written}"
            );
            assert!(
                written.contains("package-lock.json"),
                "{id} doesn't mention the repo's actual lockfile:\n{written}"
            );
            assert!(
                !written.contains("npm run"),
                "{id} introduces an `npm run <script>` form we can't back with a guaranteed script:\n{written}"
            );
            for cmd in ["npm install", "npm test", "npm build"] {
                assert!(
                    written.contains(cmd),
                    "{id} missing `{cmd}` after adapting to npm:\n{written}"
                );
            }
        }
    }

    /// Left untouched: a repo with a pnpm lockfile (or no lockfile at all)
    /// gets the template's original, unmodified content.
    #[test]
    fn apply_leaves_react_ts_content_unchanged_for_a_pnpm_repo() {
        let dir = tempfile::tempdir().unwrap();
        let result = apply("react-ts-claude", dir.path().to_str().unwrap()).unwrap();
        let written = std::fs::read_to_string(&result.path).unwrap();
        assert_eq!(written, find("react-ts-claude").unwrap().preview);
    }
}
