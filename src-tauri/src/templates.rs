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

/// Write `template_id`'s content into `dest_dir` as its `file_type` name.
/// Errors if the template id is unknown, `dest_dir` doesn't exist, or a
/// same-named file is already there — this never overwrites.
pub fn apply(template_id: &str, dest_dir: &str) -> Result<ApplyTemplateResult, String> {
    let template = find(template_id).ok_or_else(|| format!("Unknown template: {template_id}"))?;
    let dir = std::path::Path::new(dest_dir);
    if !dir.is_dir() {
        return Err(format!("{dest_dir} isn't a folder."));
    }
    let dest = dir.join(&template.file_type);
    if dest.exists() {
        return Err(format!(
            "{} already exists there — remove or rename it first.",
            template.file_type
        ));
    }
    std::fs::write(&dest, &template.preview)
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
}
