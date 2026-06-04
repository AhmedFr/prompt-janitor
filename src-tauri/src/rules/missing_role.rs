use crate::engine::{Finding, Rule, Severity, Source};

/// Flags a missing or vague role/persona at the top of the prompt.
pub struct MissingRole;

const SPECIFIC_HINTS: &[&str] = &[
    "expert",
    "engineer",
    "reviewer",
    "specialist",
    "architect",
    "developer",
];

fn is_vague_role(line: &str) -> bool {
    let l = line.trim().to_lowercase();
    l.contains("assistant") && !SPECIFIC_HINTS.iter().any(|h| l.contains(h))
}

impl Rule for MissingRole {
    fn id(&self) -> &'static str {
        "define-role"
    }
    fn title(&self) -> &'static str {
        "No clear role or persona"
    }
    fn source(&self) -> Source {
        Source::Anthropic
    }
    fn severity(&self) -> Severity {
        Severity::Mid
    }
    fn why(&self) -> &'static str {
        "A clear role grounds tone and scope. Start with who the assistant is and what it owns."
    }
    fn check(&self, content: &str) -> Vec<Finding> {
        let role_line = content
            .lines()
            .enumerate()
            .find(|(_, l)| l.trim().to_lowercase().starts_with("you are"));

        match role_line {
            None => vec![Finding {
                line: None,
                why: "No role or persona is set.".to_string(),
                fix: None,
            }],
            Some((i, line)) if is_vague_role(line) => vec![Finding {
                line: Some(i as u32 + 1),
                why: "The role is too vague — “you are an assistant” doesn't ground tone or scope."
                    .to_string(),
                fix: None,
            }],
            Some(_) => vec![],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flags_vague_role() {
        let findings = MissingRole.check("You are an assistant.");
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].line, Some(1));
    }

    #[test]
    fn accepts_specific_role() {
        assert!(MissingRole
            .check("You are a senior Rust reviewer.")
            .is_empty());
    }

    #[test]
    fn flags_absent_role() {
        let findings = MissingRole.check("Do the thing.");
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].line, None);
    }
}
