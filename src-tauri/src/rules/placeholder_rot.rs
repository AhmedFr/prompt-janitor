use std::sync::OnceLock;

use regex::Regex;

use super::line_at;
use crate::engine::{Finding, Rule, Severity, Source};

/// Flags unresolved placeholders and sentinel markers left in an instruction
/// file: `TODO`/`FIXME`/`XXX`, "lorem ipsum" filler, and `<PLACEHOLDER>` /
/// `{{placeholder}}` template variables that were never filled in.
pub struct PlaceholderRot;

fn pattern() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(
            r"\b(?i:TODO|FIXME|XXX)\b|(?i:lorem ipsum)|\{\{[^{}\n]+\}\}|<[A-Z][A-Z0-9_ -]{1,40}>",
        )
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
                    why: format!("Unresolved placeholder or sentinel: “{}”.", m.as_str()),
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
        assert_eq!(PlaceholderRot.check("FIXME later\nXXX check this").len(), 2);
    }

    #[test]
    fn flags_lorem_ipsum() {
        assert_eq!(PlaceholderRot.check("Lorem ipsum dolor sit amet.").len(), 1);
    }

    #[test]
    fn flags_template_placeholders() {
        assert_eq!(
            PlaceholderRot
                .check("Hello {{name}}, welcome to <PROJECT_NAME>.")
                .len(),
            2
        );
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
}
