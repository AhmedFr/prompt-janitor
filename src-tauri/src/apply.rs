//! Applying fixes to a file on disk. The edit math here is pure and
//! unit-tested; the command layer (`commands::apply_fix`) wraps it with disk
//! IO, the `backups` snapshot, and the optional git commit.

/// One edit: replace the first occurrence of `from` with `to`. An empty `from`
/// appends `to` as a new trailing section (used for insertions).
#[derive(Debug, Clone, serde::Deserialize, specta::Type)]
pub struct FixEdit {
    pub from: String,
    pub to: String,
}

/// The outcome of applying fixes.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct ApplyResult {
    /// The git branch the change was committed to, if the user opted in.
    pub git_ref: Option<String>,
}

/// Apply `edits` to `content` in order. Each non-empty `from` must be present
/// (its first occurrence is replaced); an empty `from` appends `to` on a new
/// line. Returns an error naming the snippet if a `from` can't be found.
pub fn apply_edits(content: &str, edits: &[FixEdit]) -> Result<String, String> {
    let mut out = content.to_string();
    for edit in edits {
        if edit.from.is_empty() {
            if !out.is_empty() && !out.ends_with('\n') {
                out.push('\n');
            }
            out.push_str(&edit.to);
            continue;
        }
        let Some(pos) = out.find(&edit.from) else {
            return Err(format!(
                "Couldn't find the text to replace: \"{}\"",
                truncate(&edit.from)
            ));
        };
        out.replace_range(pos..pos + edit.from.len(), &edit.to);
    }
    Ok(out)
}

fn truncate(s: &str) -> String {
    let trimmed: String = s.chars().take(48).collect();
    if trimmed.chars().count() < s.chars().count() {
        format!("{trimmed}…")
    } else {
        trimmed
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn edit(from: &str, to: &str) -> FixEdit {
        FixEdit {
            from: from.to_string(),
            to: to.to_string(),
        }
    }

    #[test]
    fn replaces_the_first_occurrence() {
        let out =
            apply_edits("use gpt-4 always", &[edit("gpt-4", "the configured model")]).unwrap();
        assert_eq!(out, "use the configured model always");
    }

    #[test]
    fn empty_from_appends_on_a_new_line() {
        let out = apply_edits("# Rules", &[edit("", "## Output\nReturn JSON.")]).unwrap();
        assert_eq!(out, "# Rules\n## Output\nReturn JSON.");
    }

    #[test]
    fn empty_from_does_not_double_a_trailing_newline() {
        let out = apply_edits("# Rules\n", &[edit("", "More.")]).unwrap();
        assert_eq!(out, "# Rules\nMore.");
    }

    #[test]
    fn applies_edits_in_sequence() {
        let out = apply_edits("a b c", &[edit("a", "x"), edit("c", "z")]).unwrap();
        assert_eq!(out, "x b z");
    }

    #[test]
    fn errors_when_the_snippet_is_missing() {
        let err = apply_edits("hello", &[edit("world", "x")]).unwrap_err();
        assert!(err.contains("Couldn't find"));
        assert!(err.contains("world"));
    }
}
