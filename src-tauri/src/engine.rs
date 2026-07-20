//! Rules engine framework + scoring model.
//!
//! A [`Rule`] inspects a prompt file's text and yields [`Finding`]s. The engine
//! turns findings into [`Issue`]s, then rolls them up into a 0–100 score and an
//! A–F [`Grade`]. The concrete rules live in their own module (#8); this file is
//! just the framework + the scoring math.

/// Issue severity.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, specta::Type)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    /// Critical.
    Hi,
    /// Warning.
    Mid,
    /// Nit.
    Lo,
}

/// Where a rule's authority comes from (drives the source badge).
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, specta::Type)]
#[serde(rename_all = "lowercase")]
pub enum Source {
    Anthropic,
    Openai,
    Cursor,
    Karpathy,
    Custom,
}

/// Letter grade.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, specta::Type)]
pub enum Grade {
    A,
    B,
    C,
    D,
    F,
}

impl Severity {
    /// Lowercase string form used for persistence and the frontend.
    pub fn as_str(self) -> &'static str {
        match self {
            Severity::Hi => "hi",
            Severity::Mid => "mid",
            Severity::Lo => "lo",
        }
    }
}

impl Source {
    /// Lowercase string form used for persistence and the frontend.
    pub fn as_str(self) -> &'static str {
        match self {
            Source::Anthropic => "anthropic",
            Source::Openai => "openai",
            Source::Cursor => "cursor",
            Source::Karpathy => "karpathy",
            Source::Custom => "custom",
        }
    }
}

impl Grade {
    /// The grade letter.
    pub fn letter(self) -> &'static str {
        match self {
            Grade::A => "A",
            Grade::B => "B",
            Grade::C => "C",
            Grade::D => "D",
            Grade::F => "F",
        }
    }
}

/// A suggested rewrite for an issue.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, specta::Type)]
pub struct Fix {
    pub from: String,
    pub to: String,
}

/// A concrete problem found in a file.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, specta::Type)]
pub struct Issue {
    pub rule_id: String,
    pub severity: Severity,
    pub source: Source,
    pub title: String,
    pub why: String,
    /// 1-based line number, if the issue is tied to a specific line.
    pub line: Option<u32>,
    pub fix: Option<Fix>,
}

/// Result of evaluating a file against the active rules.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, specta::Type)]
pub struct Evaluation {
    pub score: u32,
    pub grade: Grade,
    pub issues: Vec<Issue>,
}

/// A single hit produced by a [`Rule`] (the engine attaches rule metadata).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Finding {
    pub line: Option<u32>,
    pub why: String,
    pub fix: Option<Fix>,
}

/// A check that inspects prompt text and reports findings.
pub trait Rule: Send + Sync {
    fn id(&self) -> &'static str;
    fn title(&self) -> &'static str;
    fn source(&self) -> Source;
    fn severity(&self) -> Severity;
    fn why(&self) -> &'static str;
    /// Inspect `content` and return any findings.
    fn check(&self, content: &str) -> Vec<Finding>;
}

// Penalty weights, calibrated so the design's focal file (api-worker/CLAUDE.md:
// 2 critical + 2 warning + 1 nit) lands at a low D, matching the mock's 52.
const PENALTY_HI: u32 = 15;
const PENALTY_MID: u32 = 7;
const PENALTY_LO: u32 = 3;
// Caps so a pile of low-severity issues can't sink a file on its own.
const CAP_MID: u32 = 30;
const CAP_LO: u32 = 15;

/// Roll severity counts up into a 0–100 score (same math as `score_for_issues`).
pub fn score_for_counts(hi: u32, mid: u32, lo: u32) -> u32 {
    let mid_pen = (mid * PENALTY_MID).min(CAP_MID);
    let lo_pen = (lo * PENALTY_LO).min(CAP_LO);
    100u32.saturating_sub(hi * PENALTY_HI + mid_pen + lo_pen)
}

/// Roll a set of issues up into a 0–100 score.
pub fn score_for_issues(issues: &[Issue]) -> u32 {
    let mut hi = 0;
    let mut mid = 0;
    let mut lo = 0;
    for issue in issues {
        match issue.severity {
            Severity::Hi => hi += 1,
            Severity::Mid => mid += 1,
            Severity::Lo => lo += 1,
        }
    }
    score_for_counts(hi, mid, lo)
}

/// Map a 0–100 score to a letter grade. Bands are tunable (spec §5).
pub fn grade_for_score(score: u32) -> Grade {
    match score {
        90..=u32::MAX => Grade::A,
        80..=89 => Grade::B,
        65..=79 => Grade::C,
        50..=64 => Grade::D,
        _ => Grade::F,
    }
}

/// Run every rule over `content` and produce a full evaluation.
pub fn evaluate(content: &str, rules: &[Box<dyn Rule>]) -> Evaluation {
    let mut issues = Vec::new();
    for rule in rules {
        for finding in rule.check(content) {
            issues.push(Issue {
                rule_id: rule.id().to_string(),
                severity: rule.severity(),
                source: rule.source(),
                title: rule.title().to_string(),
                why: finding.why,
                line: finding.line,
                fix: finding.fix,
            });
        }
    }
    let score = score_for_issues(&issues);
    Evaluation {
        grade: grade_for_score(score),
        score,
        issues,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn issue(severity: Severity) -> Issue {
        Issue {
            rule_id: "test".into(),
            severity,
            source: Source::Anthropic,
            title: "t".into(),
            why: "w".into(),
            line: None,
            fix: None,
        }
    }

    #[test]
    fn clean_file_scores_100_grade_a() {
        assert_eq!(score_for_issues(&[]), 100);
        assert_eq!(grade_for_score(100), Grade::A);
    }

    #[test]
    fn focal_file_lands_in_d_band() {
        // api-worker/CLAUDE.md: 2 critical, 2 warning, 1 nit.
        let issues = vec![
            issue(Severity::Hi),
            issue(Severity::Hi),
            issue(Severity::Mid),
            issue(Severity::Mid),
            issue(Severity::Lo),
        ];
        let score = score_for_issues(&issues); // 100 - (30 + 14 + 3) = 53
        assert_eq!(score, 53);
        assert_eq!(grade_for_score(score), Grade::D);
    }

    #[test]
    fn nits_are_capped() {
        let many_nits: Vec<Issue> = (0..50).map(|_| issue(Severity::Lo)).collect();
        // Lo penalty capped at 15 → score 85 (B), not 0.
        assert_eq!(score_for_issues(&many_nits), 85);
    }

    #[test]
    fn grade_band_boundaries() {
        assert_eq!(grade_for_score(90), Grade::A);
        assert_eq!(grade_for_score(89), Grade::B);
        assert_eq!(grade_for_score(80), Grade::B);
        assert_eq!(grade_for_score(79), Grade::C);
        assert_eq!(grade_for_score(65), Grade::C);
        assert_eq!(grade_for_score(64), Grade::D);
        assert_eq!(grade_for_score(50), Grade::D);
        assert_eq!(grade_for_score(49), Grade::F);
    }

    struct AlwaysFlags;
    impl Rule for AlwaysFlags {
        fn id(&self) -> &'static str {
            "always"
        }
        fn title(&self) -> &'static str {
            "Always flags"
        }
        fn source(&self) -> Source {
            Source::Openai
        }
        fn severity(&self) -> Severity {
            Severity::Mid
        }
        fn why(&self) -> &'static str {
            "because"
        }
        fn check(&self, _content: &str) -> Vec<Finding> {
            vec![Finding {
                line: Some(1),
                why: "flagged".into(),
                fix: None,
            }]
        }
    }

    #[test]
    fn cursor_source_roundtrips() {
        assert_eq!(Source::Cursor.as_str(), "cursor");
    }

    #[test]
    fn evaluate_wraps_findings_into_issues() {
        let rules: Vec<Box<dyn Rule>> = vec![Box::new(AlwaysFlags)];
        let eval = evaluate("anything", &rules);
        assert_eq!(eval.issues.len(), 1);
        assert_eq!(eval.issues[0].rule_id, "always");
        assert_eq!(eval.issues[0].severity, Severity::Mid);
        assert_eq!(eval.issues[0].why, "flagged");
        assert_eq!(eval.score, 93);
        assert_eq!(eval.grade, Grade::A);
    }
}
