import { describe, it, expect } from "vitest";
import { gradeBars, issueBars } from "./analytics.util";
import type { CommonIssue, GradeCount } from "@/lib/ipc";

describe("gradeBars", () => {
  it("maps each grade to its count and theme color token", () => {
    const distribution: GradeCount[] = [
      { grade: "A", count: 3 },
      { grade: "B", count: 5 },
      { grade: "C", count: 0 },
      { grade: "D", count: 1 },
      { grade: "F", count: 2 },
    ];
    expect(gradeBars(distribution)).toEqual([
      { grade: "A", count: 3, colorVar: "--grade-a" },
      { grade: "B", count: 5, colorVar: "--grade-b" },
      { grade: "C", count: 0, colorVar: "--grade-c" },
      { grade: "D", count: 1, colorVar: "--grade-d" },
      { grade: "F", count: 2, colorVar: "--grade-f" },
    ]);
  });

  it("returns an empty array for an empty distribution", () => {
    expect(gradeBars([])).toEqual([]);
  });
});

describe("issueBars", () => {
  it("computes each bar's width relative to the largest files_affected", () => {
    const common: CommonIssue[] = [
      { title: "Missing examples", files_affected: 10 },
      { title: "Inconsistent formatting", files_affected: 5 },
      { title: "No structure", files_affected: 2 },
    ];
    expect(issueBars(common)).toEqual([
      { title: "Missing examples", files_affected: 10, pct: 100 },
      { title: "Inconsistent formatting", files_affected: 5, pct: 50 },
      { title: "No structure", files_affected: 2, pct: 20 },
    ]);
  });

  it("guards against divide-by-zero when the list is empty", () => {
    expect(issueBars([])).toEqual([]);
  });

  it("guards against divide-by-zero when every count is zero", () => {
    const common: CommonIssue[] = [{ title: "None reported", files_affected: 0 }];
    expect(issueBars(common)).toEqual([{ title: "None reported", files_affected: 0, pct: 0 }]);
  });
});
