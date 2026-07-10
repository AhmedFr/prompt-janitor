//! Rules engine framework + scoring model.
//!
//! A [`Rule`] inspects a prompt file's text and yields [`Finding`]s. The engine
//! turns findings into [`Issue`]s, then rolls them up into a 0–100 score and an
//! A–F [`Grade`]. The concrete rules live in their own module (#8); this file is
//! just the framework + the scoring math.

use std::path::Path;

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

/// The quality dimension a rule's finding speaks to — drives the per-file
/// radar chart (#88 data-viz epic).
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, specta::Type)]
pub enum Dimension {
    Clarity,
    Consistency,
    Structure,
    Examples,
    Format,
}

impl Dimension {
    /// String form used for persistence and the frontend.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Clarity => "Clarity",
            Self::Consistency => "Consistency",
            Self::Structure => "Structure",
            Self::Examples => "Examples",
            Self::Format => "Format",
        }
    }

    /// Parse a persisted dimension string. Unknown/legacy rows (written
    /// before this column existed) default to `Consistency`.
    pub fn from_db(s: &str) -> Dimension {
        match s {
            "Clarity" => Self::Clarity,
            "Structure" => Self::Structure,
            "Examples" => Self::Examples,
            "Format" => Self::Format,
            _ => Self::Consistency,
        }
    }

    pub const ALL: [Dimension; 5] = [
        Self::Clarity,
        Self::Consistency,
        Self::Structure,
        Self::Examples,
        Self::Format,
    ];
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
    pub dimension: Dimension,
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

/// Everything a rule may need beyond raw text: where the file lives and what
/// project (if any) it belongs to. Repo-grounded rules use this to check
/// facts (does this path exist? does this script exist in package.json?).
///
/// Filesystem probing driven by this context must stay cheap — `stat`/
/// `exists` calls and small bounded reads, never scanning the whole repo —
/// and must degrade gracefully: when a field is `None` (repo root couldn't
/// be determined, mtime is unavailable, …), any rule that needs it simply
/// doesn't fire rather than guessing.
pub struct RuleContext<'a> {
    pub content: &'a str,
    /// Absolute path of the file being evaluated, if known.
    pub file_path: Option<&'a Path>,
    /// The git worktree root that owns `file_path`, if one could be
    /// determined. Used by rules that reason about repo-wide activity
    /// (e.g. `stale-vs-churn`'s git-activity signal).
    pub repo_root: Option<&'a Path>,
    /// The *nearest* project root that owns `file_path` — the nearest
    /// ancestor with a manifest (`package.json`, `Cargo.toml`, …), bounded
    /// by the git worktree root. Used by rules that resolve manifest-
    /// relative facts (scripts, lockfiles, sibling paths) so a monorepo
    /// package resolves against its own manifest rather than the repo
    /// root's.
    pub resolution_root: Option<&'a Path>,
    /// The file's last-modified time, seconds since the Unix epoch.
    pub modified_unix: Option<i64>,
}

impl<'a> RuleContext<'a> {
    /// A context carrying only file content — used by content-only rules
    /// and by callers (tests, the old `evaluate` API) that have no repo
    /// context available.
    pub fn content_only(content: &'a str) -> Self {
        Self {
            content,
            file_path: None,
            repo_root: None,
            resolution_root: None,
            modified_unix: None,
        }
    }
}

/// A check that inspects prompt text and reports findings.
pub trait Rule: Send + Sync {
    fn id(&self) -> &'static str;
    fn title(&self) -> &'static str;
    fn source(&self) -> Source;
    fn severity(&self) -> Severity;
    fn why(&self) -> &'static str;
    /// The quality dimension this rule's findings speak to.
    fn dimension(&self) -> Dimension;

    /// Inspect `content` and return any findings. Content-only rules
    /// implement this. Defaults to a no-op so repo-grounded rules (which
    /// implement [`Rule::check_ctx`] instead) don't need a dummy override.
    fn check(&self, _content: &str) -> Vec<Finding> {
        Vec::new()
    }

    /// Inspect with the full evaluation context (file path, repo root,
    /// mtime). Defaults to `check(ctx.content)`, so existing content-only
    /// rules keep working unchanged.
    fn check_ctx(&self, ctx: &RuleContext<'_>) -> Vec<Finding> {
        self.check(ctx.content)
    }
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
///
/// Content-only convenience wrapper around [`evaluate_ctx`] — kept so existing
/// call sites and tests that only have raw text don't need a repo context.
pub fn evaluate(content: &str, rules: &[Box<dyn Rule>]) -> Evaluation {
    evaluate_ctx(&RuleContext::content_only(content), rules)
}

/// Run every rule over `ctx` and produce a full evaluation. Repo-grounded
/// rules use `ctx`'s file path / repo root / mtime; content-only rules just
/// read `ctx.content`.
pub fn evaluate_ctx(ctx: &RuleContext<'_>, rules: &[Box<dyn Rule>]) -> Evaluation {
    let mut issues = Vec::new();
    for rule in rules {
        for finding in rule.check_ctx(ctx) {
            issues.push(Issue {
                rule_id: rule.id().to_string(),
                severity: rule.severity(),
                source: rule.source(),
                title: rule.title().to_string(),
                why: finding.why,
                line: finding.line,
                fix: finding.fix,
                dimension: rule.dimension(),
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
            dimension: Dimension::Clarity,
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
        fn dimension(&self) -> Dimension {
            Dimension::Clarity
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
    fn every_dimension_has_a_str_roundtrip() {
        for d in Dimension::ALL {
            assert_eq!(Dimension::from_db(d.as_str()), d);
        }
    }

    #[test]
    fn dimension_all_has_five_entries() {
        assert_eq!(Dimension::ALL.len(), 5);
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
