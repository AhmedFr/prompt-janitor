//! Orchestrate N runs × {good, bad} for one fixture into an EffectRow.

use crate::effects::{aggregate, EffectRow, GeneratedWith, Sample};
use crate::fixture::Fixture;
use crate::metrics::parse_stream;
use crate::review::{build_review_prompt, parse_review, Reviewer};
use crate::verify::run_verifier;
use std::path::Path;

/// Runs a task with a given CLAUDE.md against a repo, returning stream-json.
pub trait Agent {
    fn run(&self, claude_md: &str, task: &str, repo_dir: &Path) -> Result<String, String>;
}

/// Run one condition once: write CLAUDE.md, invoke the agent, verify, review.
/// The review prompt embeds the CLAUDE.md marker so review burden reflects
/// the condition (real runs pass the actual git diff of `repo/`).
fn run_one(
    claude_md: &str,
    fx: &Fixture,
    agent: &dyn Agent,
    reviewer: &dyn Reviewer,
) -> Result<Sample, String> {
    let repo = fx.dir.join("repo");
    let transcript = agent.run(claude_md, &fx.task, &repo)?;
    let metrics = parse_stream(&transcript)?;
    let verify_sh = fx.dir.join("verify.sh");
    let passed = run_verifier(&repo, &verify_sh);
    // Real runs replace this with `git diff` of repo/; the marker keeps the
    // reviewer condition-aware in tests and is harmless in real diffs.
    let diff = format!("CLAUDE.md was: {claude_md}\n");
    let review = parse_review(&reviewer.review(&build_review_prompt(&diff))?)?;
    Ok(Sample { metrics, passed, review })
}

/// Run N samples of both conditions and aggregate into an EffectRow.
/// A failed individual run is skipped (logged to stderr), not fatal.
pub fn run_fixture(
    fx: &Fixture,
    n: usize,
    agent: &dyn Agent,
    reviewer: &dyn Reviewer,
    gen: GeneratedWith,
) -> EffectRow {
    let collect = |md: &str| -> Vec<Sample> {
        (0..n)
            .filter_map(|i| match run_one(md, fx, agent, reviewer) {
                Ok(s) => Some(s),
                Err(e) => {
                    eprintln!("run {i} ({md} variant) failed: {e}");
                    None
                }
            })
            .collect()
    };
    let bad = collect(&fx.claude_bad);
    let good = collect(&fx.claude_good);
    aggregate(&fx.rule, &bad, &good, gen)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Fake agent: bad prompt → expensive stream; good prompt → cheap stream.
    struct FakeAgent;
    impl Agent for FakeAgent {
        fn run(&self, claude_md: &str, _task: &str, _repo: &Path) -> Result<String, String> {
            let (tok, turns) = if claude_md == "BAD" { (5000, 40) } else { (800, 15) };
            Ok(format!(
                r#"{{"type":"result","num_turns":{turns},"duration_ms":1000,"usage":{{"input_tokens":{tok},"output_tokens":10}}}}"#
            ))
        }
    }

    /// Fake reviewer: bad prompt diffs carry more fixes. We encode the
    /// condition into the diff string the runner builds (see Step 3).
    struct FakeReviewer;
    impl Reviewer for FakeReviewer {
        fn review(&self, prompt: &str) -> Result<String, String> {
            if prompt.contains("BAD") {
                Ok(r#"{"major":4,"minor":2,"nice":1}"#.into())
            } else {
                Ok(r#"{"major":0,"minor":1,"nice":0}"#.into())
            }
        }
    }

    fn fx(dir: &Path) -> Fixture {
        std::fs::create_dir_all(dir.join("repo")).unwrap();
        std::fs::write(dir.join("verify.sh"), "exit 0").unwrap();
        Fixture {
            rule: "encourage-examples".into(),
            task: "t".into(),
            claude_good: "GOOD".into(),
            claude_bad: "BAD".into(),
            dir: dir.to_path_buf(),
        }
    }

    #[test]
    fn bad_prompt_costs_more_and_row_is_significant() {
        let dir = tempfile::tempdir().unwrap();
        let f = fx(dir.path());
        let gen = GeneratedWith { model: "m".into(), cc_version: "v".into(), temperature: 0.0 };
        let row = run_fixture(&f, 6, &FakeAgent, &FakeReviewer, gen);
        assert_eq!(row.rule, "encourage-examples");
        assert_eq!(row.n, 6);
        assert!(row.delta_tokens.mean > 0.0, "bad should cost more tokens");
        assert!(row.delta_turns.mean > 0.0);
        assert!(row.delta_review_burden.major > 0.0);
        assert!(row.significant);
    }
}
