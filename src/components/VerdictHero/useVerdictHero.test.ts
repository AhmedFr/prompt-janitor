import { describe, it, expect } from "vitest";
import type { FileDetail, IssueDetail } from "@/lib/ipc";
import { scoreForCounts, type SeverityCounts } from "@/lib/scoring";
import { applyFixesSequentially, compute, type FixCandidate } from "./useVerdictHero";

// These tests exercise the fix-path derivation logic directly (not just
// through pre-built VerdictData fixtures, see VerdictHero.test.tsx), so a
// regression in the sequential-points math fails here instead of only
// showing up as a visual mismatch between a row's "+N pts" and the
// projected grade.

function issue(title: string, severity: IssueDetail["severity"]): IssueDetail {
  return { line: null, severity, source: "custom", title, why: "", fix_from: null, fix_to: null };
}

function fileDetail(id: string, name: string, score: number, issues: IssueDetail[]): FileDetail {
  return {
    id,
    name,
    project: "p",
    path: `/${name}`,
    grade: "C",
    score,
    content: "",
    issues,
    delta: null,
    dimensions: [],
  };
}

describe("applyFixesSequentially", () => {
  it("gives each row the true marginal gain, matching the actual projected delta (capped-mid repro)", () => {
    // One file, 5 open mid issues, score 70 (mid penalty capped at 30).
    const countsById = new Map<string, SeverityCounts>([["f1", { hi: 0, mid: 5, lo: 0 }]]);
    const candidates: FixCandidate[] = [
      { fileId: "f1", fileName: "a.md", title: "mid-1", severity: "mid" },
      { fileId: "f1", fileName: "a.md", title: "mid-2", severity: "mid" },
      { fileId: "f1", fileName: "a.md", title: "mid-3", severity: "mid" },
    ];

    const { rows, projected } = applyFixesSequentially(candidates, countsById);

    // Independently (against the pristine mid:5 count) every row would show
    // +2, summing to 6 — understating the true, capped-aware jump.
    expect(rows.map((r) => r.points)).toEqual([2, 7, 7]);
    const totalPoints = rows.reduce((n, r) => n + r.points, 0);
    const actualDelta =
      scoreForCounts({ hi: 0, mid: 2, lo: 0 }) - scoreForCounts({ hi: 0, mid: 5, lo: 0 });
    expect(totalPoints).toBe(16);
    expect(totalPoints).toBe(actualDelta);
    expect(projected.get("f1")).toEqual({ hi: 0, mid: 2, lo: 0 });
  });

  it("reports zero points for a row that's still capped after earlier rows in the sequence claimed the pool", () => {
    // 8 open mids: penalty is capped at 30 all the way down to mid = 5
    // (5 × 7 = 35, still > 30). So the first three sequential fixes each
    // land on a still-capped count and recover nothing.
    const countsById = new Map<string, SeverityCounts>([["f1", { hi: 0, mid: 8, lo: 0 }]]);
    const candidates: FixCandidate[] = [
      { fileId: "f1", fileName: "a.md", title: "mid-1", severity: "mid" },
      { fileId: "f1", fileName: "a.md", title: "mid-2", severity: "mid" },
      { fileId: "f1", fileName: "a.md", title: "mid-3", severity: "mid" },
    ];

    const { rows, projected } = applyFixesSequentially(candidates, countsById);

    expect(rows.map((r) => r.points)).toEqual([0, 0, 0]);
    // The running count still moves even though none of the plateaued
    // fixes score any points — later rows (or the projection) must see it.
    expect(projected.get("f1")).toEqual({ hi: 0, mid: 5, lo: 0 });
  });

  it("tracks running counts independently per file while still summing correctly across files", () => {
    const countsById = new Map<string, SeverityCounts>([
      ["a", { hi: 0, mid: 5, lo: 0 }],
      ["b", { hi: 2, mid: 0, lo: 0 }],
    ]);
    const candidates: FixCandidate[] = [
      { fileId: "a", fileName: "a.md", title: "a-mid-1", severity: "mid" },
      { fileId: "b", fileName: "b.md", title: "b-hi-1", severity: "hi" },
      { fileId: "a", fileName: "a.md", title: "a-mid-2", severity: "mid" },
    ];

    const { rows, projected } = applyFixesSequentially(candidates, countsById);

    // File b's hi fix sits between file a's two mid fixes but must not
    // perturb file a's running mid count (or vice versa).
    expect(rows.map((r) => r.points)).toEqual([2, 15, 7]);
    expect(projected.get("a")).toEqual({ hi: 0, mid: 3, lo: 0 });
    expect(projected.get("b")).toEqual({ hi: 1, mid: 0, lo: 0 });

    const totalPoints = rows.reduce((n, r) => n + r.points, 0);
    const actualDelta =
      scoreForCounts({ hi: 0, mid: 3, lo: 0 }) -
      scoreForCounts({ hi: 0, mid: 5, lo: 0 }) +
      (scoreForCounts({ hi: 1, mid: 0, lo: 0 }) - scoreForCounts({ hi: 2, mid: 0, lo: 0 }));
    expect(totalPoints).toBe(24);
    expect(totalPoints).toBe(actualDelta);
  });
});

describe("compute", () => {
  it("wires the fix path through the sequential derivation so displayed points sum to the projected grade jump", () => {
    const issues = ["mid-1", "mid-2", "mid-3", "mid-4", "mid-5"].map((title) => issue(title, "mid"));
    const detail = fileDetail("f1", "a.md", 70, issues);

    const result = compute([{ id: "f1", score: 70 }], [detail]);

    expect(result.fixPath.map((r) => r.title)).toEqual(["mid-1", "mid-2", "mid-3"]);
    expect(result.fixPath.map((r) => r.points)).toEqual([2, 7, 7]);
    // 70 + 16 = 86, which crosses into a B (>= 80).
    expect(result.projectedGrade).toBe("B");
  });

  it("keeps per-file counts independent across files in the full compute pipeline", () => {
    const fileA = fileDetail(
      "a",
      "a.md",
      70,
      ["a-mid-1", "a-mid-2"].map((title) => issue(title, "mid")),
    );
    const fileB = fileDetail("b", "b.md", 70, [issue("b-hi-1", "hi")]);

    const result = compute(
      [
        { id: "a", score: 70 },
        { id: "b", score: 70 },
      ],
      [fileA, fileB],
    );

    // Hi-severity issues sort ahead of mid, so b's fix leads the path.
    expect(result.fixPath.map((r) => `${r.fileId}:${r.title}`)).toEqual([
      "b:b-hi-1",
      "a:a-mid-1",
      "a:a-mid-2",
    ]);
    expect(result.fixPath.map((r) => r.points)).toEqual([15, 7, 7]);
  });
});
