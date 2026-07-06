use std::sync::OnceLock;

use regex::Regex;

use super::line_at;
use crate::engine::{Finding, Rule, Severity, Source};

/// Flags unresolved placeholders and sentinel markers left in an instruction
/// file: `TODO:`/`FIXME:`/`XXX:` (colon required) and "lorem ipsum" filler.
///
/// Deliberately narrow: earlier versions also flagged bare `{{...}}` and
/// uppercase `<TAG>` spans and a colon-less `TODO`/`FIXME`/`XXX` keyword,
/// but those read GitHub Actions `${{ }}` interpolation, legitimate
/// structured-output tags like `<ANSWER>`, and ordinary prose ("add a TODO
/// comment") as unresolved placeholders. A colon-suffixed marker is the
/// only shape that's unambiguously a leftover sentinel.
pub struct PlaceholderRot;

fn pattern() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"\b(?i:TODO|FIXME|XXX)\s*:|(?i:lorem ipsum)")
            .expect("valid placeholder-rot regex")
    })
}

impl Rule for PlaceholderRot {
    fn id(&self) -> &'static str {
        "placeholder-rot"
    }
    fn title(&self) -> &'static str {
        "Unresolved placeholder or TODO"
    }
    fn source(&self) -> Source {
        Source::Custom
    }
    fn severity(&self) -> Severity {
        Severity::Mid
    }
    fn why(&self) -> &'static str {
        "TODOs and unfilled placeholders mean the agent is reading a draft, not a finished instruction."
    }
    fn check(&self, content: &str) -> Vec<Finding> {
        pattern()
            .find_iter(content)
            .map(|m| {
                let line = line_at(content, m.start());
                Finding {
                    line: Some(line),
                    why: format!(
                        "Unresolved placeholder or sentinel: “{}”.",
                        m.as_str().trim()
                    ),
                    fix: None,
                }
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flags_todo() {
        assert_eq!(PlaceholderRot.check("TODO: fill this in").len(), 1);
    }

    #[test]
    fn flags_fixme_and_xxx() {
        assert_eq!(
            PlaceholderRot.check("FIXME: later\nXXX: check this").len(),
            2
        );
    }

    #[test]
    fn flags_lorem_ipsum() {
        assert_eq!(PlaceholderRot.check("Lorem ipsum dolor sit amet.").len(), 1);
    }

    #[test]
    fn accepts_clean_file() {
        assert!(PlaceholderRot
            .check("You are a senior Rust reviewer for this service.")
            .is_empty());
    }

    #[test]
    fn does_not_flag_lowercase_angle_brackets_or_html() {
        assert!(PlaceholderRot
            .check("Wrap output in <response> tags, e.g. a<b comparisons.")
            .is_empty());
    }

    // Adversarial-review repros (#92): structured-output tags, GitHub
    // Actions `${{ }}` interpolation, and a bare (colon-less) TODO in prose
    // must never fire.
    #[test]
    fn ignores_structured_output_tags() {
        assert!(PlaceholderRot
            .check("Respond only inside <ANSWER> tags")
            .is_empty());
        assert!(PlaceholderRot
            .check("Wrap reasoning in <SCRATCHPAD>")
            .is_empty());
    }

    #[test]
    fn ignores_github_actions_interpolation() {
        assert!(PlaceholderRot
            .check(r#"run: echo "${{ github.actor }}""#)
            .is_empty());
        assert!(PlaceholderRot
            .check("Never hardcode secrets; use ${{ secrets.TOKEN }} instead.")
            .is_empty());
    }

    #[test]
    fn ignores_bare_todo_without_colon() {
        assert!(PlaceholderRot
            .check("When you leave work unfinished, add a TODO comment explaining what remains.")
            .is_empty());
    }
}
