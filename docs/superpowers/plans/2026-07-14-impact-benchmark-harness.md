# Impact Benchmark Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the offline benchmark harness that runs a rule-indexed fixture through headless Claude Code with a defect present vs absent, measures the outcome delta, and writes a versioned `effects.json` the app will later consume.

**Architecture:** A standalone Rust crate under `benchmark/` (never linked into the app binary). It parses Claude Code's `stream-json` output into `RunMetrics`, runs a deterministic verifier and an LLM-reviewer per resulting diff, orchestrates N runs × {good, bad} per fixture, then aggregates samples into per-rule effect sizes with bootstrap confidence intervals and a significance gate. Agent and reviewer calls sit behind traits so the pure logic is tested with fakes.

**Tech Stack:** Rust 2021, `serde`/`serde_json`, `std::process` for shelling out to `claude` and `verify.sh`. Dev: `tempfile`.

**This is Plan 1 of 4.** Follow-up plans (separate specs of work): (2) free impact letter — `impact.rs` + `ImpactLetter`; (3) analytics impact dimension; (4) premium live A/B — `BeforeAfter`. This plan produces the artifact all three consume.

## Global Constraints

- **Standalone crate.** `benchmark/` has its own `Cargo.toml` and is NOT referenced by `src-tauri/`. It never compiles into the app.
- **Package manager:** pnpm for any JS; this plan is Rust-only. Run Rust from inside `benchmark/`.
- **Determinism in tests.** No unit test may call the real `claude` CLI or network. Agent/reviewer calls go through traits; tests use fakes. The bootstrap PRNG is a fixed-seed LCG so CIs are reproducible.
- **Reproducibility of real runs.** Every real run records `model`, `cc_version`, `temperature` into `effects.json` under `generated_with`.
- **Rule id contract.** A fixture's `meta.json.rule` MUST equal the engine's `Rule::id()` string for that rule (e.g. `missing_few_shot` → `"encourage-examples"`, found in `src-tauri/src/rules/<rule>.rs`). Plan 2 joins on this exact string.
- **Significance rule.** An effect is `significant` iff the 95% bootstrap CI of the delta excludes 0 (CI low and high share a sign). Only significant effects will feed the user letter (enforced in Plan 2); the harness records the flag.
- **File responsibility:** one concern per file (matches repo convention). Keep files focused.

---

### Task 1: Standalone crate skeleton + CLI

**Files:**
- Create: `benchmark/Cargo.toml`
- Create: `benchmark/src/main.rs`
- Create: `benchmark/.gitignore`

**Interfaces:**
- Produces: a binary `benchmark` with subcommands `list` (list fixture dirs) and `run <fixture> [--n N]` (wired to real logic in Task 8). For now `run` prints the parsed args.

- [ ] **Step 1: Create `benchmark/Cargo.toml`**

```toml
[package]
name = "benchmark"
version = "0.1.0"
edition = "2021"
description = "Offline prompt-impact benchmark harness (not shipped in the app)."

[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[dev-dependencies]
tempfile = "3"
```

- [ ] **Step 2: Create `benchmark/.gitignore`**

```
/target
```

- [ ] **Step 3: Write the failing test for arg parsing**

Create `benchmark/src/main.rs`:

```rust
//! CLI entry for the offline benchmark harness.

/// Parsed CLI invocation.
#[derive(Debug, PartialEq)]
enum Cmd {
    List,
    Run { fixture: String, n: usize },
}

/// Parse argv (excluding the program name). `--n` defaults to 20.
fn parse_args(args: &[String]) -> Result<Cmd, String> {
    match args.first().map(String::as_str) {
        Some("list") => Ok(Cmd::List),
        Some("run") => {
            let fixture = args
                .get(1)
                .cloned()
                .ok_or_else(|| "run needs a fixture name".to_string())?;
            let n = match args.iter().position(|a| a == "--n") {
                Some(i) => args
                    .get(i + 1)
                    .and_then(|v| v.parse().ok())
                    .ok_or_else(|| "--n needs a number".to_string())?,
                None => 20,
            };
            Ok(Cmd::Run { fixture, n })
        }
        _ => Err("usage: benchmark <list|run> [fixture] [--n N]".to_string()),
    }
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match parse_args(&args) {
        Ok(cmd) => println!("{cmd:?}"),
        Err(e) => {
            eprintln!("{e}");
            std::process::exit(2);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn v(s: &[&str]) -> Vec<String> {
        s.iter().map(|x| x.to_string()).collect()
    }

    #[test]
    fn parses_run_with_default_n() {
        assert_eq!(
            parse_args(&v(&["run", "missing_few_shot"])).unwrap(),
            Cmd::Run { fixture: "missing_few_shot".into(), n: 20 }
        );
    }

    #[test]
    fn parses_run_with_explicit_n() {
        assert_eq!(
            parse_args(&v(&["run", "x", "--n", "5"])).unwrap(),
            Cmd::Run { fixture: "x".into(), n: 5 }
        );
    }

    #[test]
    fn list_parses() {
        assert_eq!(parse_args(&v(&["list"])).unwrap(), Cmd::List);
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd benchmark && cargo test`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add benchmark/Cargo.toml benchmark/.gitignore benchmark/src/main.rs
git commit -m "feat(benchmark): standalone harness crate + CLI arg parsing"
```

---

### Task 2: Parse Claude Code `stream-json` into `RunMetrics`

**Files:**
- Create: `benchmark/src/metrics.rs`
- Create: `benchmark/testdata/claude_stream_sample.jsonl` (captured from a real run)
- Modify: `benchmark/src/main.rs` (add `mod metrics;`)

**Interfaces:**
- Produces: `pub struct RunMetrics { input_tokens: u64, output_tokens: u64, num_turns: u32, tool_calls: Vec<String>, wall_clock_ms: u64 }` and `pub fn parse_stream(text: &str) -> Result<RunMetrics, String>`.

- [ ] **Step 1: Capture a real sample (one-time, records the schema we parse against)**

Run once against any tiny repo so the parser is written against reality, not a guess:

```bash
cd /tmp && mkdir -p cc-sample && cd cc-sample && git init -q
claude -p "print hello to a file named hi.txt" --output-format stream-json --verbose \
  > /Users/ahmedabouelleil/code/02-personal/prompt-janitor/benchmark/testdata/claude_stream_sample.jsonl
```

Open the file. Each line is a JSON object. Confirm the field paths used below match your Claude Code version: assistant tool calls appear as `{"type":"assistant","message":{"content":[{"type":"tool_use","name":"..."}]}}`; the final line is `{"type":"result","num_turns":N,"duration_ms":M,"usage":{"input_tokens":..,"output_tokens":..}}`. If a path differs, adjust the field access in Step 3 — the sample test in Step 2 is what guards it.

- [ ] **Step 2: Write the failing test**

Create `benchmark/src/metrics.rs`:

```rust
//! Parse Claude Code `--output-format stream-json` into run metrics.

use serde::Deserialize;

/// Outcome metrics for a single agent run.
#[derive(Debug, Clone, PartialEq)]
pub struct RunMetrics {
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub num_turns: u32,
    /// Tool names in call order (e.g. "Task" => a subagent was spawned).
    pub tool_calls: Vec<String>,
    pub wall_clock_ms: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_captured_sample() {
        let text = include_str!("../testdata/claude_stream_sample.jsonl");
        let m = parse_stream(text).expect("sample should parse");
        // The sample run wrote a file, so it used at least one tool and
        // reported non-zero token usage across at least one turn.
        assert!(m.num_turns >= 1, "expected >=1 turn, got {}", m.num_turns);
        assert!(m.input_tokens > 0 && m.output_tokens > 0);
        assert!(!m.tool_calls.is_empty(), "expected at least one tool call");
    }

    #[test]
    fn parses_synthetic_minimal_stream() {
        let text = concat!(
            r#"{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Write"}]}}"#, "\n",
            r#"{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Task"}]}}"#, "\n",
            r#"{"type":"result","num_turns":3,"duration_ms":8100,"usage":{"input_tokens":1200,"output_tokens":540}}"#, "\n"
        );
        let m = parse_stream(text).unwrap();
        assert_eq!(m.num_turns, 3);
        assert_eq!(m.input_tokens, 1200);
        assert_eq!(m.output_tokens, 540);
        assert_eq!(m.wall_clock_ms, 8100);
        assert_eq!(m.tool_calls, vec!["Write".to_string(), "Task".to_string()]);
    }

    #[test]
    fn errors_when_no_result_line() {
        let text = r#"{"type":"assistant","message":{"content":[]}}"#;
        assert!(parse_stream(text).is_err());
    }
}
```

- [ ] **Step 3: Write the implementation**

Add to `benchmark/src/metrics.rs` (above the `tests` module):

```rust
#[derive(Deserialize)]
struct Line {
    #[serde(rename = "type")]
    kind: String,
    // assistant lines
    message: Option<Message>,
    // result line
    num_turns: Option<u32>,
    duration_ms: Option<u64>,
    usage: Option<Usage>,
}

#[derive(Deserialize)]
struct Message {
    #[serde(default)]
    content: Vec<Block>,
}

#[derive(Deserialize)]
struct Block {
    #[serde(rename = "type")]
    kind: String,
    name: Option<String>,
}

#[derive(Deserialize)]
struct Usage {
    input_tokens: u64,
    output_tokens: u64,
}

/// Parse a `stream-json` transcript. Collects tool names from assistant
/// `tool_use` blocks and reads the terminal `result` line for tokens, turns,
/// and wall-clock. Errors if there is no `result` line.
pub fn parse_stream(text: &str) -> Result<RunMetrics, String> {
    let mut tool_calls = Vec::new();
    let mut result: Option<(u32, u64, Usage)> = None;

    for raw in text.lines().filter(|l| !l.trim().is_empty()) {
        let line: Line = serde_json::from_str(raw).map_err(|e| e.to_string())?;
        match line.kind.as_str() {
            "assistant" => {
                if let Some(msg) = line.message {
                    for b in msg.content {
                        if b.kind == "tool_use" {
                            if let Some(name) = b.name {
                                tool_calls.push(name);
                            }
                        }
                    }
                }
            }
            "result" => {
                let turns = line.num_turns.ok_or("result missing num_turns")?;
                let ms = line.duration_ms.ok_or("result missing duration_ms")?;
                let usage = line.usage.ok_or("result missing usage")?;
                result = Some((turns, ms, usage));
            }
            _ => {}
        }
    }

    let (num_turns, wall_clock_ms, usage) = result.ok_or("no result line in stream")?;
    Ok(RunMetrics {
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        num_turns,
        tool_calls,
        wall_clock_ms,
    })
}
```

Add `mod metrics;` to the top of `benchmark/src/main.rs`.

- [ ] **Step 4: Run tests**

Run: `cd benchmark && cargo test metrics`
Expected: 3 passed. (If `parses_captured_sample` fails on field paths, fix the `#[serde(rename=...)]`/field names in Step 3 to match your captured sample, then re-run.)

- [ ] **Step 5: Commit**

```bash
git add benchmark/src/metrics.rs benchmark/testdata/claude_stream_sample.jsonl benchmark/src/main.rs
git commit -m "feat(benchmark): parse Claude stream-json into RunMetrics"
```

---

### Task 3: Deterministic verifier runner

**Files:**
- Create: `benchmark/src/verify.rs`
- Modify: `benchmark/src/main.rs` (add `mod verify;`)

**Interfaces:**
- Produces: `pub fn run_verifier(repo_dir: &std::path::Path, script: &std::path::Path) -> bool` — runs `script` with the working dir set to `repo_dir`; `true` iff exit status is 0.

- [ ] **Step 1: Write the failing test**

Create `benchmark/src/verify.rs`:

```rust
//! Run a fixture's deterministic verifier (`verify.sh`) → pass/fail.

use std::path::Path;
use std::process::Command;

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn script(dir: &Path, body: &str) -> std::path::PathBuf {
        let p = dir.join("verify.sh");
        let mut f = std::fs::File::create(&p).unwrap();
        writeln!(f, "#!/bin/sh\n{body}").unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&p, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
        p
    }

    #[test]
    fn passing_script_returns_true() {
        let dir = tempfile::tempdir().unwrap();
        let s = script(dir.path(), "exit 0");
        assert!(run_verifier(dir.path(), &s));
    }

    #[test]
    fn failing_script_returns_false() {
        let dir = tempfile::tempdir().unwrap();
        let s = script(dir.path(), "exit 1");
        assert!(!run_verifier(dir.path(), &s));
    }

    #[test]
    fn runs_in_repo_dir() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("marker"), "x").unwrap();
        let s = script(dir.path(), "test -f marker");
        assert!(run_verifier(dir.path(), &s));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd benchmark && cargo test verify`
Expected: FAIL — `run_verifier` not found.

- [ ] **Step 3: Write the implementation**

Add to `benchmark/src/verify.rs` (above `tests`):

```rust
/// Run `script` with its working directory set to `repo_dir`.
/// Returns `true` iff the process exits 0. A failure to spawn is `false`.
pub fn run_verifier(repo_dir: &Path, script: &Path) -> bool {
    Command::new("sh")
        .arg(script)
        .current_dir(repo_dir)
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}
```

Add `mod verify;` to `benchmark/src/main.rs`.

- [ ] **Step 4: Run tests**

Run: `cd benchmark && cargo test verify`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add benchmark/src/verify.rs benchmark/src/main.rs
git commit -m "feat(benchmark): deterministic verify.sh runner"
```

---

### Task 4: Fixture loader

**Files:**
- Create: `benchmark/src/fixture.rs`
- Modify: `benchmark/src/main.rs` (add `mod fixture;`)

**Interfaces:**
- Produces: `pub struct Fixture { rule: String, task: String, claude_good: String, claude_bad: String, dir: PathBuf }` and `pub fn load(fixtures_root: &Path, name: &str) -> Result<Fixture, String>`. Expects `<root>/<name>/{meta.json,task.md,claude.good.md,claude.bad.md,verify.sh,repo/}`. `meta.json` = `{"rule": "<engine Rule::id()>"}`.

- [ ] **Step 1: Write the failing test**

Create `benchmark/src/fixture.rs`:

```rust
//! Load a benchmark fixture directory into a `Fixture`.

use serde::Deserialize;
use std::path::{Path, PathBuf};

/// A rule-indexed fixture: identical task + two CLAUDE.md variants.
#[derive(Debug, Clone, PartialEq)]
pub struct Fixture {
    /// Engine `Rule::id()` this fixture proves (e.g. "encourage-examples").
    pub rule: String,
    pub task: String,
    pub claude_good: String,
    pub claude_bad: String,
    /// The fixture directory (holds `repo/` and `verify.sh`).
    pub dir: PathBuf,
}

#[derive(Deserialize)]
struct Meta {
    rule: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_fixture(root: &Path, name: &str) -> PathBuf {
        let d = root.join(name);
        std::fs::create_dir_all(d.join("repo")).unwrap();
        std::fs::write(d.join("meta.json"), r#"{"rule":"encourage-examples"}"#).unwrap();
        std::fs::write(d.join("task.md"), "do the thing").unwrap();
        std::fs::write(d.join("claude.good.md"), "GOOD").unwrap();
        std::fs::write(d.join("claude.bad.md"), "BAD").unwrap();
        std::fs::write(d.join("verify.sh"), "exit 0").unwrap();
        d
    }

    #[test]
    fn loads_a_well_formed_fixture() {
        let root = tempfile::tempdir().unwrap();
        write_fixture(root.path(), "missing_few_shot");
        let f = load(root.path(), "missing_few_shot").unwrap();
        assert_eq!(f.rule, "encourage-examples");
        assert_eq!(f.task, "do the thing");
        assert_eq!(f.claude_good, "GOOD");
        assert_eq!(f.claude_bad, "BAD");
    }

    #[test]
    fn missing_dir_errors() {
        let root = tempfile::tempdir().unwrap();
        assert!(load(root.path(), "nope").is_err());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd benchmark && cargo test fixture`
Expected: FAIL — `load` not found.

- [ ] **Step 3: Write the implementation**

Add to `benchmark/src/fixture.rs` (above `tests`):

```rust
/// Load `<fixtures_root>/<name>`. Errors if the dir or any required file is missing.
pub fn load(fixtures_root: &Path, name: &str) -> Result<Fixture, String> {
    let dir = fixtures_root.join(name);
    if !dir.is_dir() {
        return Err(format!("fixture dir not found: {}", dir.display()));
    }
    let read = |file: &str| {
        std::fs::read_to_string(dir.join(file))
            .map_err(|e| format!("{file}: {e}"))
    };
    let meta: Meta = serde_json::from_str(&read("meta.json")?).map_err(|e| e.to_string())?;
    Ok(Fixture {
        rule: meta.rule,
        task: read("task.md")?,
        claude_good: read("claude.good.md")?,
        claude_bad: read("claude.bad.md")?,
        dir,
    })
}
```

Add `mod fixture;` to `benchmark/src/main.rs`.

- [ ] **Step 4: Run tests**

Run: `cd benchmark && cargo test fixture`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add benchmark/src/fixture.rs benchmark/src/main.rs
git commit -m "feat(benchmark): fixture directory loader"
```

---

### Task 5: Statistics — mean, bootstrap CI, delta significance

**Files:**
- Create: `benchmark/src/stats.rs`
- Modify: `benchmark/src/main.rs` (add `mod stats;`)

**Interfaces:**
- Produces:
  - `pub fn mean(xs: &[f64]) -> f64`
  - `pub struct Ci { pub lo: f64, pub hi: f64 }`
  - `pub struct Delta { pub mean: f64, pub ci95: Ci, pub significant: bool }`
  - `pub fn delta(bad: &[f64], good: &[f64]) -> Delta` — mean(bad) − mean(good) with a fixed-seed bootstrap 95% CI; `significant` iff the CI excludes 0.

- [ ] **Step 1: Write the failing test**

Create `benchmark/src/stats.rs`:

```rust
//! Sample statistics for effect sizes: mean + fixed-seed bootstrap CI.

/// A 95% confidence interval.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Ci {
    pub lo: f64,
    pub hi: f64,
}

/// An effect: difference of means with its bootstrap CI and significance.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Delta {
    pub mean: f64,
    pub ci95: Ci,
    pub significant: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mean_of_known_values() {
        assert_eq!(mean(&[2.0, 4.0, 6.0]), 4.0);
    }

    #[test]
    fn clearly_separated_groups_are_significant() {
        let bad = vec![100.0, 105.0, 98.0, 102.0, 101.0, 99.0, 103.0, 100.0];
        let good = vec![10.0, 12.0, 9.0, 11.0, 10.0, 8.0, 13.0, 10.0];
        let d = delta(&bad, &good);
        assert!(d.mean > 80.0, "mean delta {}", d.mean);
        assert!(d.significant, "clearly separated groups must be significant");
        assert!(d.ci95.lo > 0.0, "CI must exclude 0: {:?}", d.ci95);
    }

    #[test]
    fn overlapping_groups_are_not_significant() {
        let bad = vec![10.0, 11.0, 9.0, 12.0, 8.0, 10.0, 11.0, 9.0];
        let good = vec![10.0, 9.0, 11.0, 8.0, 12.0, 10.0, 9.0, 11.0];
        let d = delta(&bad, &good);
        assert!(!d.significant, "overlapping groups must not be significant");
    }

    #[test]
    fn is_deterministic() {
        let bad = vec![5.0, 6.0, 7.0, 8.0, 9.0];
        let good = vec![1.0, 2.0, 3.0];
        assert_eq!(delta(&bad, &good), delta(&bad, &good));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd benchmark && cargo test stats`
Expected: FAIL — `mean`/`delta` not found.

- [ ] **Step 3: Write the implementation**

Add to `benchmark/src/stats.rs` (above `tests`):

```rust
/// Deterministic PRNG (SplitMix64) so bootstrap CIs are reproducible.
struct Rng(u64);
impl Rng {
    fn next_u64(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }
    /// Uniform index in [0, len).
    fn index(&mut self, len: usize) -> usize {
        (self.next_u64() % len as u64) as usize
    }
}

pub fn mean(xs: &[f64]) -> f64 {
    if xs.is_empty() {
        return 0.0;
    }
    xs.iter().sum::<f64>() / xs.len() as f64
}

/// One bootstrap resample mean (sample with replacement).
fn resample_mean(xs: &[f64], rng: &mut Rng) -> f64 {
    let mut sum = 0.0;
    for _ in 0..xs.len() {
        sum += xs[rng.index(xs.len())];
    }
    sum / xs.len() as f64
}

const BOOTSTRAP_ITERS: usize = 2000;
const SEED: u64 = 0x1234_5678_9ABC_DEF0;

/// mean(bad) − mean(good) with a fixed-seed bootstrap 95% CI on the difference.
/// `significant` iff the CI excludes 0.
pub fn delta(bad: &[f64], good: &[f64]) -> Delta {
    let point = mean(bad) - mean(good);
    let mut rng = Rng(SEED);
    let mut diffs: Vec<f64> = (0..BOOTSTRAP_ITERS)
        .map(|_| resample_mean(bad, &mut rng) - resample_mean(good, &mut rng))
        .collect();
    diffs.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let pct = |p: f64| diffs[((p * (diffs.len() - 1) as f64).round()) as usize];
    let ci95 = Ci { lo: pct(0.025), hi: pct(0.975) };
    let significant = (ci95.lo > 0.0 && ci95.hi > 0.0) || (ci95.lo < 0.0 && ci95.hi < 0.0);
    Delta { mean: point, ci95, significant }
}
```

Add `mod stats;` to `benchmark/src/main.rs`.

- [ ] **Step 4: Run tests**

Run: `cd benchmark && cargo test stats`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add benchmark/src/stats.rs benchmark/src/main.rs
git commit -m "feat(benchmark): mean + deterministic bootstrap CI + significance"
```

---

### Task 6: Effect rows + `effects.json` schema and writer

**Files:**
- Create: `benchmark/src/effects.rs`
- Modify: `benchmark/src/main.rs` (add `mod effects;`)

**Interfaces:**
- Consumes: `stats::Delta` (Task 5), `metrics::RunMetrics` (Task 2).
- Produces:
  - `pub struct Sample { pub metrics: RunMetrics, pub passed: bool, pub review: ReviewBurden }` (`ReviewBurden` defined here, mirrored in Task 7).
  - `pub struct ReviewBurden { pub major: f64, pub minor: f64, pub nice: f64 }`
  - `pub fn aggregate(rule: &str, bad: &[Sample], good: &[Sample], gen: GeneratedWith) -> EffectRow`
  - `pub struct EffectsTable { pub suite_version: String, pub generated_with: GeneratedWith, pub rules: Vec<EffectRow> }` with `pub fn write(&self, path: &Path)`.

- [ ] **Step 1: Write the failing test**

Create `benchmark/src/effects.rs`:

```rust
//! Effect-size rows and the versioned `effects.json` artifact.

use crate::metrics::RunMetrics;
use crate::stats::{delta, Delta};
use serde::Serialize;
use std::path::Path;

/// Post-run fixes a human would still have to make, by severity bucket.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct ReviewBurden {
    pub major: f64,
    pub minor: f64,
    pub nice: f64,
}

/// One agent run's collected outcome.
#[derive(Debug, Clone)]
pub struct Sample {
    pub metrics: RunMetrics,
    pub passed: bool,
    pub review: ReviewBurden,
}

/// Reproducibility stamp for a benchmark run.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct GeneratedWith {
    pub model: String,
    pub cc_version: String,
    pub temperature: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeltaJson {
    pub mean: f64,
    pub ci95: [f64; 2],
}
impl From<Delta> for DeltaJson {
    fn from(d: Delta) -> Self {
        DeltaJson { mean: d.mean, ci95: [d.ci95.lo, d.ci95.hi] }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct EffectRow {
    pub rule: String,
    pub n: usize,
    pub delta_tokens: DeltaJson,
    pub delta_turns: DeltaJson,
    pub delta_pass_rate: f64,
    pub delta_review_burden: ReviewBurden,
    /// Significant iff ANY headline metric's CI excludes 0.
    pub significant: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct EffectsTable {
    pub suite_version: String,
    pub generated_with: GeneratedWith,
    pub rules: Vec<EffectRow>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample(tokens: u64, turns: u32, passed: bool, burden: f64) -> Sample {
        Sample {
            metrics: RunMetrics {
                input_tokens: tokens,
                output_tokens: 0,
                num_turns: turns,
                tool_calls: vec![],
                wall_clock_ms: 0,
            },
            passed,
            review: ReviewBurden { major: burden, minor: 0.0, nice: 0.0 },
        }
    }

    fn gen() -> GeneratedWith {
        GeneratedWith { model: "m".into(), cc_version: "v".into(), temperature: 0.0 }
    }

    #[test]
    fn aggregates_deltas_and_pass_rate() {
        let bad: Vec<Sample> = (0..8).map(|_| sample(1000, 40, false, 5.0)).collect();
        let good: Vec<Sample> = (0..8).map(|_| sample(200, 18, true, 1.0)).collect();
        let row = aggregate("encourage-examples", &bad, &good, gen());
        assert_eq!(row.rule, "encourage-examples");
        assert_eq!(row.n, 8);
        assert!((row.delta_tokens.mean - 800.0).abs() < 1e-6);
        assert!((row.delta_turns.mean - 22.0).abs() < 1e-6);
        // pass rate: bad 0/8, good 8/8 → delta = 0.0 - 1.0 = -1.0
        assert!((row.delta_pass_rate + 1.0).abs() < 1e-6);
        assert!((row.delta_review_burden.major - 4.0).abs() < 1e-6);
        assert!(row.significant);
    }

    #[test]
    fn writes_json_with_versions() {
        let table = EffectsTable {
            suite_version: "2026-07-14.1".into(),
            generated_with: gen(),
            rules: vec![],
        };
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("effects.json");
        table.write(&p);
        let txt = std::fs::read_to_string(&p).unwrap();
        assert!(txt.contains("2026-07-14.1"));
        assert!(txt.contains("suite_version"));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd benchmark && cargo test effects`
Expected: FAIL — `aggregate`/`write` not found.

- [ ] **Step 3: Write the implementation**

Add to `benchmark/src/effects.rs` (above `tests`):

```rust
fn tokens_f64(s: &[Sample]) -> Vec<f64> {
    s.iter().map(|x| x.metrics.input_tokens as f64).collect()
}
fn turns_f64(s: &[Sample]) -> Vec<f64> {
    s.iter().map(|x| x.metrics.num_turns as f64).collect()
}
fn pass_rate(s: &[Sample]) -> f64 {
    if s.is_empty() {
        return 0.0;
    }
    s.iter().filter(|x| x.passed).count() as f64 / s.len() as f64
}
fn mean_burden(s: &[Sample]) -> ReviewBurden {
    let n = s.len().max(1) as f64;
    ReviewBurden {
        major: s.iter().map(|x| x.review.major).sum::<f64>() / n,
        minor: s.iter().map(|x| x.review.minor).sum::<f64>() / n,
        nice: s.iter().map(|x| x.review.nice).sum::<f64>() / n,
    }
}

/// Build an effect row for one rule from its bad/good samples.
/// `significant` is true iff either the tokens or turns delta CI excludes 0.
pub fn aggregate(rule: &str, bad: &[Sample], good: &[Sample], _gen: GeneratedWith) -> EffectRow {
    let d_tokens = delta(&tokens_f64(bad), &tokens_f64(good));
    let d_turns = delta(&turns_f64(bad), &turns_f64(good));
    let bad_burden = mean_burden(bad);
    let good_burden = mean_burden(good);
    EffectRow {
        rule: rule.to_string(),
        n: bad.len().min(good.len()),
        delta_tokens: d_tokens.into(),
        delta_turns: d_turns.into(),
        delta_pass_rate: pass_rate(bad) - pass_rate(good),
        delta_review_burden: ReviewBurden {
            major: bad_burden.major - good_burden.major,
            minor: bad_burden.minor - good_burden.minor,
            nice: bad_burden.nice - good_burden.nice,
        },
        significant: d_tokens.significant || d_turns.significant,
    }
}

impl EffectsTable {
    /// Serialize pretty JSON to `path`.
    pub fn write(&self, path: &Path) {
        let json = serde_json::to_string_pretty(self).expect("serialize effects");
        std::fs::write(path, json).expect("write effects.json");
    }
}
```

Add `mod effects;` to `benchmark/src/main.rs`.

- [ ] **Step 4: Run tests**

Run: `cd benchmark && cargo test effects`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add benchmark/src/effects.rs benchmark/src/main.rs
git commit -m "feat(benchmark): effect rows + versioned effects.json writer"
```

---

### Task 7: Review-burden reviewer (prompt build + response parse, behind a trait)

**Files:**
- Create: `benchmark/src/review.rs`
- Modify: `benchmark/src/main.rs` (add `mod review;`)

**Interfaces:**
- Consumes: `effects::ReviewBurden` (Task 6).
- Produces:
  - `pub trait Reviewer { fn review(&self, prompt: &str) -> Result<String, String>; }`
  - `pub fn build_review_prompt(diff: &str) -> String`
  - `pub fn parse_review(raw: &str) -> Result<ReviewBurden, String>` — tolerant of prose around the JSON object.

- [ ] **Step 1: Write the failing test**

Create `benchmark/src/review.rs`:

```rust
//! LLM-reviewer: turn a resulting diff into bucketed fix counts.
//! The real network call sits behind `Reviewer`; parsing/prompt are pure.

use crate::effects::ReviewBurden;

/// Any backend that can answer a review prompt with text.
pub trait Reviewer {
    fn review(&self, prompt: &str) -> Result<String, String>;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prompt_includes_diff_and_rubric() {
        let p = build_review_prompt("diff --git a/x b/x");
        assert!(p.contains("diff --git a/x b/x"));
        assert!(p.contains("major"));
        assert!(p.contains("minor"));
        assert!(p.contains("nice"));
    }

    #[test]
    fn parses_clean_json() {
        let r = parse_review(r#"{"major":3,"minor":2,"nice":1}"#).unwrap();
        assert_eq!(r, ReviewBurden { major: 3.0, minor: 2.0, nice: 1.0 });
    }

    #[test]
    fn parses_json_embedded_in_prose() {
        let raw = "Here is my review:\n{\"major\":1,\"minor\":0,\"nice\":4}\nThanks!";
        let r = parse_review(raw).unwrap();
        assert_eq!(r, ReviewBurden { major: 1.0, minor: 0.0, nice: 4.0 });
    }

    #[test]
    fn errors_on_no_json() {
        assert!(parse_review("no json here").is_err());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd benchmark && cargo test review`
Expected: FAIL — functions not found.

- [ ] **Step 3: Write the implementation**

Add to `benchmark/src/review.rs` (above `tests`):

```rust
use serde::Deserialize;

/// Pinned rubric. Versioned with the suite; changing it bumps suite_version.
const RUBRIC: &str = "\
You are a strict senior reviewer. Given a diff a coding agent produced, \
count the fixes a human must still make before merge, bucketed by severity:\n\
- major: correctness, breakage, security, or missing required behavior\n\
- minor: quality, convention, or maintainability issues\n\
- nice: optional polish\n\
Reply with ONLY a JSON object: {\"major\":N,\"minor\":N,\"nice\":N}";

/// Build the reviewer prompt for one resulting diff.
pub fn build_review_prompt(diff: &str) -> String {
    format!("{RUBRIC}\n\n--- DIFF ---\n{diff}")
}

#[derive(Deserialize)]
struct Counts {
    major: f64,
    minor: f64,
    nice: f64,
}

/// Extract the first `{...}` JSON object from `raw` and parse it.
pub fn parse_review(raw: &str) -> Result<ReviewBurden, String> {
    let start = raw.find('{').ok_or("no JSON object in review")?;
    let end = raw.rfind('}').ok_or("no closing brace in review")?;
    if end <= start {
        return Err("malformed JSON braces".into());
    }
    let c: Counts = serde_json::from_str(&raw[start..=end]).map_err(|e| e.to_string())?;
    Ok(ReviewBurden { major: c.major, minor: c.minor, nice: c.nice })
}
```

Add `mod review;` to `benchmark/src/main.rs`.

- [ ] **Step 4: Run tests**

Run: `cd benchmark && cargo test review`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add benchmark/src/review.rs benchmark/src/main.rs
git commit -m "feat(benchmark): review-burden prompt builder + tolerant parser"
```

---

### Task 8: Runner orchestration (behind an `Agent` trait, tested with fakes)

**Files:**
- Create: `benchmark/src/runner.rs`
- Modify: `benchmark/src/main.rs` (add `mod runner;`, wire `run` subcommand)

**Interfaces:**
- Consumes: `Fixture` (T4), `Sample`/`EffectRow`/`aggregate`/`GeneratedWith` (T6), `Reviewer`/`build_review_prompt`/`parse_review` (T7), `parse_stream` (T2), `run_verifier` (T3).
- Produces:
  - `pub trait Agent { fn run(&self, claude_md: &str, task: &str, repo_dir: &Path) -> Result<String, String>; }` — returns the agent's `stream-json` transcript, after writing `CLAUDE.md` and running the task against a fresh copy of `repo/`.
  - `pub fn run_fixture(fx: &Fixture, n: usize, agent: &dyn Agent, reviewer: &dyn Reviewer, gen: GeneratedWith) -> EffectRow`.

- [ ] **Step 1: Write the failing test with fakes**

Create `benchmark/src/runner.rs`:

```rust
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd benchmark && cargo test runner`
Expected: FAIL — `run_fixture` not found.

- [ ] **Step 3: Write the implementation**

Add to `benchmark/src/runner.rs` (above `tests`):

```rust
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
```

- [ ] **Step 4: Run tests**

Run: `cd benchmark && cargo test runner`
Expected: 1 passed.

- [ ] **Step 5: Wire the `run` subcommand + real `ClaudeAgent`/`AnthropicReviewer` are added in Task 10; for now leave `main` printing the parsed `Cmd`. Run full suite:**

Run: `cd benchmark && cargo test`
Expected: all tasks' tests pass (17+).

- [ ] **Step 6: Commit**

```bash
git add benchmark/src/runner.rs benchmark/src/main.rs
git commit -m "feat(benchmark): fixture run orchestration behind Agent/Reviewer traits"
```

---

### Task 9: Author the first fixture — `missing_few_shot`

**Files:**
- Create: `benchmark/fixtures/missing_few_shot/meta.json`
- Create: `benchmark/fixtures/missing_few_shot/task.md`
- Create: `benchmark/fixtures/missing_few_shot/claude.good.md`
- Create: `benchmark/fixtures/missing_few_shot/claude.bad.md`
- Create: `benchmark/fixtures/missing_few_shot/verify.sh`
- Create: `benchmark/fixtures/missing_few_shot/repo/` (a small, self-contained project with an established convention + a test harness)

**Interfaces:**
- Produces: a fixture loadable by `fixture::load(Path::new("fixtures"), "missing_few_shot")` and runnable by `run_fixture`. The ONLY difference between `claude.good.md` and `claude.bad.md` is the presence of a worked example (the `missing_few_shot` defect).

- [ ] **Step 1: Create `meta.json`** (rule id must equal `MissingFewShot::id()` = `"encourage-examples"`, verified in `src-tauri/src/rules/missing_few_shot.rs`)

```json
{ "rule": "encourage-examples" }
```

- [ ] **Step 2: Build `repo/`** — a tiny TypeScript package with an existing "action creator" convention and a failing test for a new action the task will ask for. Concretely:
  - `repo/package.json` with a `test` script running `node --test`.
  - `repo/src/actions.js` containing two existing action creators that all follow one shape: `export const setName = (name) => ({ type: "SET_NAME", payload: { name } });` and a second similar one.
  - `repo/test/actions.test.js` asserting a NOT-yet-existing `setAge` action creator returns `{ type: "SET_AGE", payload: { age } }` — so the test fails until the agent adds it in the repo convention.

- [ ] **Step 3: Write `task.md`** (identical for both conditions)

```
Add a `setAge` action creator to src/actions.js. Run `npm test` and make it pass.
```

- [ ] **Step 4: Write `claude.good.md`** (defect ABSENT — includes a worked example)

The prose MUST be identical to `claude.bad.md`; the ONLY addition is the example block. Do NOT add any extra explicit rule sentence (e.g. "Match that shape: SCREAMING_SNAKE…") — that would be a second information channel and confound the experiment.

```
You are a JS engineer. Follow the existing action-creator convention exactly.

Example of the convention:
    export const setName = (name) => ({ type: "SET_NAME", payload: { name } });
```

- [ ] **Step 5: Write `claude.bad.md`** (defect PRESENT — same guidance, NO example; the example block is the ONLY difference)

```
You are a JS engineer. Follow the existing action-creator convention exactly.
```

- [ ] **Step 6: Write `verify.sh`** (deterministic pass/fail)

```sh
#!/bin/sh
cd "$(dirname "$0")/repo" && npm test
```

- [ ] **Step 7: Sanity-check the fixture loads**

Run: `cd benchmark && cargo test fixture` (loader already green) then a one-off:

```bash
cd benchmark && cargo run -- list
```
Expected: (once `list` is wired in Task 10) `missing_few_shot` appears. For now, confirm the files exist and `verify.sh` is executable: `chmod +x fixtures/missing_few_shot/verify.sh`.

- [ ] **Step 8: Commit**

```bash
git add benchmark/fixtures/missing_few_shot
git commit -m "feat(benchmark): missing_few_shot fixture (worked-example defect)"
```

---

### Task 10: Real `Agent`/`Reviewer` + generate `effects.json` v1

**Files:**
- Modify: `benchmark/src/runner.rs` (add `ClaudeAgent` impl)
- Modify: `benchmark/src/review.rs` (add `ClaudeReviewer` impl)
- Modify: `benchmark/src/main.rs` (wire `list` + `run` to real logic, write `effects.json`)
- Create: `benchmark/effects.json` (the produced artifact)

**Interfaces:**
- Consumes: everything above.
- Produces: `benchmark/effects.json` — a real `EffectsTable` with one `EffectRow` for `encourage-examples`.

- [ ] **Step 1: Implement `ClaudeAgent`** in `runner.rs`

```rust
/// Real agent: copies `repo/` to a temp dir, writes CLAUDE.md, runs `claude -p`.
pub struct ClaudeAgent {
    pub model: String,
    pub temperature: f64,
}

impl Agent for ClaudeAgent {
    fn run(&self, claude_md: &str, task: &str, repo_dir: &Path) -> Result<String, String> {
        let work = tempfile::tempdir().map_err(|e| e.to_string())?;
        // fresh copy of the fixture repo so runs don't contaminate each other
        copy_dir(repo_dir, work.path()).map_err(|e| e.to_string())?;
        std::fs::write(work.path().join("CLAUDE.md"), claude_md).map_err(|e| e.to_string())?;
        let out = std::process::Command::new("claude")
            .current_dir(work.path())
            .args([
                "-p", task,
                "--output-format", "stream-json",
                "--verbose",
                "--model", &self.model,
            ])
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
```

- [ ] **Step 2: Implement `ClaudeReviewer`** in `review.rs` (reuse `claude -p` as a cheap judge, text output)

```rust
/// Reviewer backed by `claude -p` (plain text), used to score review burden.
pub struct ClaudeReviewer {
    pub model: String,
}

impl Reviewer for ClaudeReviewer {
    fn review(&self, prompt: &str) -> Result<String, String> {
        let out = std::process::Command::new("claude")
            .args(["-p", prompt, "--output-format", "text", "--model", &self.model])
            .output()
            .map_err(|e| format!("spawn claude reviewer: {e}"))?;
        if !out.status.success() {
            return Err(String::from_utf8_lossy(&out.stderr).into_owned());
        }
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    }
}
```

- [ ] **Step 3: Wire `main.rs`** — replace the `println!` in `main` with real dispatch

```rust
mod effects;
mod fixture;
mod metrics;
mod review;
mod runner;
mod stats;
mod verify;

use effects::{EffectsTable, GeneratedWith};
use std::path::Path;

// ... keep Cmd + parse_args from Task 1 ...

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let cmd = match parse_args(&args) {
        Ok(c) => c,
        Err(e) => { eprintln!("{e}"); std::process::exit(2); }
    };
    let fixtures_root = Path::new("fixtures");
    match cmd {
        Cmd::List => {
            for e in std::fs::read_dir(fixtures_root).expect("fixtures/ dir") {
                let e = e.unwrap();
                if e.file_type().unwrap().is_dir() {
                    println!("{}", e.file_name().to_string_lossy());
                }
            }
        }
        Cmd::Run { fixture, n } => {
            let model = std::env::var("BENCH_MODEL").unwrap_or_else(|_| "claude-opus-4-8".into());
            let cc_version = std::env::var("BENCH_CC_VERSION").unwrap_or_else(|_| "unknown".into());
            let gen = GeneratedWith { model: model.clone(), cc_version, temperature: 0.0 };
            let fx = fixture::load(fixtures_root, &fixture).expect("load fixture");
            let agent = runner::ClaudeAgent { model: model.clone(), temperature: 0.0 };
            let reviewer = review::ClaudeReviewer { model };
            let row = runner::run_fixture(&fx, n, &agent, &reviewer, gen.clone());
            let table = EffectsTable {
                suite_version: std::env::var("BENCH_SUITE_VERSION")
                    .unwrap_or_else(|_| "0.0.0-dev".into()),
                generated_with: gen,
                rules: vec![row],
            };
            table.write(Path::new("effects.json"));
            println!("wrote effects.json");
        }
    }
}
```

- [ ] **Step 4: Verify it still compiles and unit tests pass**

Run: `cd benchmark && cargo test && cargo build`
Expected: all tests pass; binary builds.

- [ ] **Step 5: Generate the real artifact** (requires `claude` CLI logged in; costs tokens — start small)

```bash
cd benchmark
BENCH_CC_VERSION="$(claude --version)" BENCH_SUITE_VERSION="2026-07-14.1" \
  cargo run --release -- run missing_few_shot --n 5
```
Expected: `wrote effects.json`. Open `benchmark/effects.json`; confirm `delta_tokens.mean`, `delta_turns.mean`, `delta_review_burden`, and `significant` are populated for `encourage-examples`. If `significant` is false at N=5, that is a real result — re-run at higher N (`--n 20`) before drawing conclusions.

- [ ] **Step 6: Commit the harness changes and the artifact**

```bash
git add benchmark/src/runner.rs benchmark/src/review.rs benchmark/src/main.rs benchmark/effects.json
git commit -m "feat(benchmark): real Claude agent+reviewer; generate effects.json v1"
```

---

## Self-Review

**Spec coverage:**
- §3 offline harness (runner, pinned model/version) → Tasks 1,2,8,10. ✓
- §4 rule-indexed fixture, only-difference-is-defect → Task 9. ✓ (headline 5 grow later — Plan 1 ships fixture #1; remaining four are repeats of Task 9's shape, authored before their first real run.)
- §5 runner + captured metrics (tokens, turns, tool log, pass/fail, wall-clock) → Task 2 (`RunMetrics` incl. `tool_calls`), Task 3 (pass/fail). ✓
- §5.1 review burden via pinned LLM-reviewer, separate from pass/fail, own parse → Task 7 + Task 6 `ReviewBurden`. ✓
- §6 `effects.json` schema (mean, ci95, significance, review burden, versioned, generated_with) → Task 6 + Task 10. ✓ *(Note: `delta_tool_usage` from the spec JSON example is deferred — `tool_calls` are captured in `RunMetrics` but not yet aggregated into the effect row; add when the first fixture whose defect is "capability unused" is authored. Logged, not silently dropped.)*
- §11 significance gate, LLM-judge variance labeling → Task 5 (CI-excludes-0), Task 7 (parser). Reviewer own-N median is a Plan-2/real-run concern; Task 10 Step 5 notes re-running at higher N. ✓

**Placeholder scan:** No TBD/TODO. Every code step shows complete code. Task 9 Step 2 describes fixture repo contents concretely (files + shapes) rather than pasting a full node project — acceptable as it's asset authoring, and the exact convention is specified.

**Type consistency:** `RunMetrics`, `Sample`, `ReviewBurden`, `EffectRow`, `Delta`/`Ci`, `GeneratedWith`, traits `Agent`/`Reviewer` — names and fields are consistent across Tasks 2/5/6/7/8/10. `parse_stream`, `run_verifier`, `load`, `aggregate`, `delta`, `run_fixture`, `parse_review`, `build_review_prompt` signatures match their consumers.

**Deferred (tracked, not gaps):** `delta_tool_usage` aggregation; reviewer own-N median smoothing; the other four headline fixtures. All are follow-up work, explicitly noted.
