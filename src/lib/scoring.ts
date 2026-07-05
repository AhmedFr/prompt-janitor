import type { Grade, Severity } from "./ipc";

// TS mirror of the Rust scoring engine (src-tauri/src/engine.rs). The unit
// tests pin these constants to the Rust ones — change both sides together.
export const PENALTY_HI = 15;
export const PENALTY_MID = 7;
export const PENALTY_LO = 3;
export const CAP_MID = 30;
export const CAP_LO = 15;

/** Open-issue counts for one file, keyed by severity. */
export interface SeverityCounts {
  hi: number;
  mid: number;
  lo: number;
}

/** Roll severity counts up into a 0–100 score (mirrors `score_for_counts`). */
export function scoreForCounts({ hi, mid, lo }: SeverityCounts): number {
  const midPen = Math.min(mid * PENALTY_MID, CAP_MID);
  const loPen = Math.min(lo * PENALTY_LO, CAP_LO);
  return Math.max(0, 100 - (hi * PENALTY_HI + midPen + loPen));
}

/** Map a 0–100 score to a letter grade (mirrors `grade_for_score`). */
export function gradeForScore(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 65) return "C";
  if (score >= 50) return "D";
  return "F";
}

/**
 * Aggregate per-file scores into the overall score, exactly like the backend:
 * `COALESCE(AVG(score), 100)` cast to an integer (truncation).
 */
export function overallFromFileScores(scores: number[]): number {
  if (scores.length === 0) return 100;
  return Math.trunc(scores.reduce((a, b) => a + b, 0) / scores.length);
}

/** Points a file's score gains when one issue of `severity` is fixed. */
export function pointsRecoverable(counts: SeverityCounts, severity: Severity): number {
  const after = { ...counts, [severity]: Math.max(0, counts[severity] - 1) };
  return scoreForCounts(after) - scoreForCounts(counts);
}

const SEVERITIES: Severity[] = ["hi", "mid", "lo"];

/**
 * How many issues must be fixed for the overall score to reach ≥ 90 (an A).
 *
 * Greedy simulation: repeatedly fix the single open issue with the highest
 * marginal gain (ties broken Hi > Mid > Lo, then file order). Zero-gain fixes
 * (issues buried under a severity cap) still count — they must be cleared
 * before the score can move. Fixing everything always yields 100, so this
 * terminates.
 */
export function fixesToReachA(files: SeverityCounts[]): number {
  const counts = files.map((f) => ({ ...f }));
  let fixes = 0;
  while (overallFromFileScores(counts.map(scoreForCounts)) < 90) {
    let best: { file: number; severity: Severity; gain: number } | null = null;
    for (let i = 0; i < counts.length; i++) {
      for (const severity of SEVERITIES) {
        if (counts[i][severity] === 0) continue;
        const gain = pointsRecoverable(counts[i], severity);
        const sevRank = SEVERITIES.indexOf(severity);
        const bestRank = best ? SEVERITIES.indexOf(best.severity) : SEVERITIES.length;
        if (!best || gain > best.gain || (gain === best.gain && sevRank < bestRank)) {
          best = { file: i, severity, gain };
        }
      }
    }
    if (!best) break; // no open issues left — unreachable unless already ≥ 90
    counts[best.file][best.severity] -= 1;
    fixes += 1;
  }
  return fixes;
}
