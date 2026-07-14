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
