use crate::engine::{Finding, Rule, RuleContext, Severity, Source};

/// Flags `.cursorrules` files: Cursor's docs have deprecated the single flat
/// rules file in favor of scoped rules under `.cursor/rules/*.mdc`. Fires
/// purely on filename — a `.cursorrules` file unconditionally uses the
/// legacy format, so this is zero-FP by construction.
pub struct LegacyCursorrules;

impl Rule for LegacyCursorrules {
    fn id(&self) -> &'static str {
        "legacy-cursorrules"
    }
    fn title(&self) -> &'static str {
        "Legacy .cursorrules format"
    }
    fn source(&self) -> Source {
        Source::Cursor
    }
    fn severity(&self) -> Severity {
        Severity::Lo
    }
    fn why(&self) -> &'static str {
        "Cursor's docs deprecate .cursorrules in favor of scoped, composable rules in .cursor/rules/*.mdc (Cursor docs, \"Rules\" migration guidance)."
    }
    fn check_ctx(&self, ctx: &RuleContext<'_>) -> Vec<Finding> {
        let is_cursorrules = ctx
            .file_path
            .and_then(|p| p.file_name())
            .and_then(|n| n.to_str())
            .map(|n| n == ".cursorrules")
            .unwrap_or(false);
        if !is_cursorrules {
            return Vec::new();
        }
        vec![Finding {
            line: None,
            why: "This is a .cursorrules file — migrate to .cursor/rules/*.mdc.".to_string(),
            fix: None,
        }]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn flags_cursorrules_file() {
        let ctx = RuleContext {
            content: "always use tabs",
            file_path: Some(Path::new("/repo/.cursorrules")),
            repo_root: None,
            modified_unix: None,
        };
        assert_eq!(LegacyCursorrules.check_ctx(&ctx).len(), 1);
    }

    #[test]
    fn ignores_other_files() {
        let ctx = RuleContext {
            content: "always use tabs",
            file_path: Some(Path::new("/repo/AGENTS.md")),
            repo_root: None,
            modified_unix: None,
        };
        assert!(LegacyCursorrules.check_ctx(&ctx).is_empty());
    }

    #[test]
    fn does_not_fire_without_a_file_path() {
        let ctx = RuleContext::content_only("always use tabs");
        assert!(LegacyCursorrules.check_ctx(&ctx).is_empty());
    }
}
