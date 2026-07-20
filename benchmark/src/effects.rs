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
    /// `claude -p` does not currently expose a temperature control, so this
    /// records the requested/assumed value for provenance, not a verified
    /// applied parameter.
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
    /// Significant iff the tokens OR turns delta CI excludes 0. (Pass-rate and
    /// review-burden have no CI and do not participate in this flag.)
    pub significant: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct EffectsTable {
    pub suite_version: String,
    pub generated_with: GeneratedWith,
    pub rules: Vec<EffectRow>,
}

fn tokens_f64(s: &[Sample]) -> Vec<f64> {
    s.iter().map(|x| x.metrics.total_input_tokens() as f64).collect()
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

#[cfg(test)]
mod tests {
    use super::*;

    fn sample(tokens: u64, turns: u32, passed: bool, burden: f64) -> Sample {
        Sample {
            metrics: RunMetrics {
                input_tokens: tokens,
                output_tokens: 0,
                cache_creation_input_tokens: 0,
                cache_read_input_tokens: 0,
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
