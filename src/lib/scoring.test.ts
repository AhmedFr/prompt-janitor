import { describe, it, expect } from "vitest";
import {
  PENALTY_HI,
  PENALTY_MID,
  PENALTY_LO,
  CAP_MID,
  CAP_LO,
  scoreForCounts,
  gradeForScore,
  overallFromFileScores,
  pointsRecoverable,
  fixesToReachA,
} from "./scoring";

// These tests pin the TS mirror to the Rust engine (src-tauri/src/engine.rs).
// If a constant changes on one side, a test here must fail.

describe("scoring constants", () => {
  it("match the Rust engine", () => {
    expect(PENALTY_HI).toBe(15);
    expect(PENALTY_MID).toBe(7);
    expect(PENALTY_LO).toBe(3);
    expect(CAP_MID).toBe(30);
    expect(CAP_LO).toBe(15);
  });
});

describe("scoreForCounts", () => {
  it("scores a clean file at 100", () => {
    expect(scoreForCounts({ hi: 0, mid: 0, lo: 0 })).toBe(100);
  });

  it("matches the engine's focal-file example (2 hi, 2 mid, 1 lo → 53)", () => {
    // Mirrors `mixed_severities_match_design_focal_file` in engine.rs.
    expect(scoreForCounts({ hi: 2, mid: 2, lo: 1 })).toBe(53);
  });

  it("caps the lo penalty at 15 (12 nits → 85, not 64)", () => {
    // Mirrors `lo_cap_prevents_nit_avalanche` in engine.rs.
    expect(scoreForCounts({ hi: 0, mid: 0, lo: 12 })).toBe(85);
  });

  it("caps the mid penalty at 30 (10 warnings → 70)", () => {
    expect(scoreForCounts({ hi: 0, mid: 10, lo: 0 })).toBe(70);
  });

  it("clamps at 0 instead of going negative", () => {
    expect(scoreForCounts({ hi: 10, mid: 0, lo: 0 })).toBe(0);
  });
});

describe("gradeForScore", () => {
  it("matches the engine's band boundaries", () => {
    // Mirrors `grade_band_boundaries` in engine.rs.
    expect(gradeForScore(100)).toBe("A");
    expect(gradeForScore(90)).toBe("A");
    expect(gradeForScore(89)).toBe("B");
    expect(gradeForScore(80)).toBe("B");
    expect(gradeForScore(79)).toBe("C");
    expect(gradeForScore(65)).toBe("C");
    expect(gradeForScore(64)).toBe("D");
    expect(gradeForScore(50)).toBe("D");
    expect(gradeForScore(49)).toBe("F");
    expect(gradeForScore(0)).toBe("F");
  });
});

describe("overallFromFileScores", () => {
  it("returns 100 when there are no files (COALESCE(AVG, 100))", () => {
    expect(overallFromFileScores([])).toBe(100);
  });

  it("truncates the average like the Rust `as u32` cast", () => {
    // AVG(85, 90) = 87.5 → 87, not 88.
    expect(overallFromFileScores([85, 90])).toBe(87);
    expect(overallFromFileScores([53, 100, 100])).toBe(84);
  });
});

describe("pointsRecoverable", () => {
  it("recovers the full penalty for an uncapped issue", () => {
    expect(pointsRecoverable({ hi: 1, mid: 0, lo: 0 }, "hi")).toBe(15);
    expect(pointsRecoverable({ hi: 0, mid: 2, lo: 0 }, "mid")).toBe(7);
    expect(pointsRecoverable({ hi: 0, mid: 0, lo: 1 }, "lo")).toBe(3);
  });

  it("recovers nothing while the severity cap still binds", () => {
    // 10 mids: penalty capped at 30; removing one leaves 9×7 = 63 → still 30.
    expect(pointsRecoverable({ hi: 0, mid: 10, lo: 0 }, "mid")).toBe(0);
    // 5 mids → 4 mids crosses under the cap: 30 → 28.
    expect(pointsRecoverable({ hi: 0, mid: 5, lo: 0 }, "mid")).toBe(2);
  });

  it("accounts for the 0 clamp", () => {
    // 10 hi = clamped 0; removing one → 100 − 135 still clamps to 0.
    expect(pointsRecoverable({ hi: 10, mid: 0, lo: 0 }, "hi")).toBe(0);
  });
});

describe("fixesToReachA", () => {
  it("is 0 when already an A", () => {
    expect(fixesToReachA([{ hi: 0, mid: 0, lo: 0 }])).toBe(0);
    expect(fixesToReachA([])).toBe(0);
    // One lo: 97 ≥ 90 already.
    expect(fixesToReachA([{ hi: 0, mid: 0, lo: 1 }])).toBe(0);
  });

  it("counts the single critical that blocks an A", () => {
    // 1 hi → 85 (B); fixing it → 100.
    expect(fixesToReachA([{ hi: 1, mid: 0, lo: 0 }])).toBe(1);
  });

  it("fixes highest-impact issues first across files", () => {
    // File A: 1 hi (85), file B: clean (100) → overall 92... already A.
    // Make it harder: file A: 2 hi (70), file B: 100 → overall 85 (B).
    // One hi fix → 85/100 → overall 92 (A). So n = 1.
    expect(
      fixesToReachA([
        { hi: 2, mid: 0, lo: 0 },
        { hi: 0, mid: 0, lo: 0 },
      ]),
    ).toBe(1);
  });

  it("clears capped issues when that is the only way up", () => {
    // 6 mids: 70. Cap binds until mid ≤ 4. Reaching ≥ 90 needs mid ≤ 1
    // (2 mids → 86). So 5 fixes: 6→5 (70), 5→4 (72), 4→3 (79), 3→2 (86), 2→1 (93).
    expect(fixesToReachA([{ hi: 0, mid: 6, lo: 0 }])).toBe(5);
  });
});
