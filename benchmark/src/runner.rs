//! Orchestrate N runs × {good, bad} for one fixture into an EffectRow.

use crate::effects::{aggregate, EffectRow, GeneratedWith, Sample};
use crate::fixture::Fixture;
use crate::metrics::parse_stream;
use crate::review::{build_review_prompt, parse_review, Reviewer};
use crate::verify::run_verifier;
use std::path::Path;

/// Runs a task in an already-prepared working directory (CLAUDE.md already
/// written into it by the caller), returning the stream-json transcript.
pub trait Agent {
    fn run(&self, task: &str, work_dir: &Path) -> Result<String, String>;
}

/// Real agent: runs `claude -p` in the prepared work_dir (CLAUDE.md already present).
pub struct ClaudeAgent {
    pub model: String,
}
impl Agent for ClaudeAgent {
    fn run(&self, task: &str, work_dir: &Path) -> Result<String, String> {
        let out = std::process::Command::new("claude")
            .current_dir(work_dir)
            .args(["-p", task, "--output-format", "stream-json", "--verbose", "--model", &self.model])
            .output()
            .map_err(|e| format!("spawn claude: {e}"))?;
        if !out.status.success() {
            return Err(String::from_utf8_lossy(&out.stderr).into_owned());
        }
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    }
}

fn copy_dir(src: &Path, dst: &Path) -> std::io::Result<()> {
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let to = dst.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            std::fs::create_dir_all(&to)?;
            copy_dir(&entry.path(), &to)?;
        } else {
            std::fs::copy(entry.path(), &to)?;
        }
    }
    Ok(())
}

/// Run one condition once: prepare a fresh work dir from the pristine
/// fixture repo, write CLAUDE.md, invoke the agent there, then verify AND
/// diff the agent's actual output in that same work dir.
fn run_one(
    claude_md: &str,
    fx: &Fixture,
    agent: &dyn Agent,
    reviewer: &dyn Reviewer,
) -> Result<Sample, String> {
    let work = tempfile::tempdir().map_err(|e| e.to_string())?;
    let pristine = fx.dir.join("repo");
    copy_dir(&pristine, work.path()).map_err(|e| e.to_string())?;
    std::fs::write(work.path().join("CLAUDE.md"), claude_md).map_err(|e| e.to_string())?;
    let transcript = agent.run(&fx.task, work.path())?;
    let metrics = parse_stream(&transcript)?;
    let passed = run_verifier(work.path(), &fx.dir.join("verify.sh"));
    let diff = diff_dirs(&pristine, work.path());
    let review = parse_review(&reviewer.review(&build_review_prompt(&diff))?)?;
    Ok(Sample { metrics, passed, review })
}

/// Minimal textual diff for the reviewer: every file under `modified` whose
/// contents differ from (or are absent in) `pristine`, shown with its new
/// contents. Deterministic (sorted). Skips harness/noise paths.
fn diff_dirs(pristine: &Path, modified: &Path) -> String {
    let mut files = Vec::new();
    collect_files(modified, modified, &mut files);
    files.sort();
    let mut out = String::new();
    for rel in files {
        let new = std::fs::read_to_string(modified.join(&rel)).unwrap_or_default();
        let old = std::fs::read_to_string(pristine.join(&rel)).unwrap_or_default();
        if new != old {
            out.push_str(&format!("=== {} ===\n{}\n", rel.display(), new));
        }
    }
    out
}

fn collect_files(root: &Path, dir: &Path, out: &mut Vec<std::path::PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for e in entries.flatten() {
        let p = e.path();
        let name = e.file_name();
        if name == "node_modules" || name == ".git" || name == "CLAUDE.md" {
            continue;
        }
        if p.is_dir() {
            collect_files(root, &p, out);
        } else if let Ok(rel) = p.strip_prefix(root) {
            out.push(rel.to_path_buf());
        }
    }
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
    let collect = |md: &str, label: &str| -> Vec<Sample> {
        (0..n)
            .filter_map(|i| match run_one(md, fx, agent, reviewer) {
                Ok(s) => Some(s),
                Err(e) => {
                    eprintln!("run {i} [{}/{}] failed: {e}", fx.rule, label);
                    None
                }
            })
            .collect()
    };
    let bad = collect(&fx.claude_bad, "bad");
    let good = collect(&fx.claude_good, "good");
    aggregate(&fx.rule, &bad, &good, gen)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Fake agent: bad prompt → expensive stream; good prompt → cheap stream.
    /// Reads the condition from the CLAUDE.md the orchestrator wrote into
    /// work_dir, and writes a file so diff_dirs is non-empty and condition-aware.
    struct FakeAgent;
    impl Agent for FakeAgent {
        fn run(&self, _task: &str, work_dir: &Path) -> Result<String, String> {
            let md = std::fs::read_to_string(work_dir.join("CLAUDE.md")).unwrap_or_default();
            let (tok, turns) = if md == "BAD" { (5000, 40) } else { (800, 15) };
            std::fs::write(work_dir.join("result.txt"), format!("{md} run")).unwrap();
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

    #[test]
    fn diff_dirs_reports_only_changed_and_new_files() {
        let pristine = tempfile::tempdir().unwrap();
        let modified = tempfile::tempdir().unwrap();
        std::fs::write(pristine.path().join("a.txt"), "same").unwrap();
        std::fs::write(modified.path().join("a.txt"), "same").unwrap(); // unchanged
        std::fs::write(pristine.path().join("b.txt"), "old").unwrap();
        std::fs::write(modified.path().join("b.txt"), "new").unwrap(); // changed
        std::fs::write(modified.path().join("c.txt"), "added").unwrap(); // new
        std::fs::write(modified.path().join("CLAUDE.md"), "x").unwrap(); // skipped
        let d = diff_dirs(pristine.path(), modified.path());
        assert!(d.contains("b.txt") && d.contains("new"));
        assert!(d.contains("c.txt") && d.contains("added"));
        assert!(!d.contains("a.txt")); // unchanged not shown
        assert!(!d.contains("CLAUDE.md")); // harness file skipped
    }
}
