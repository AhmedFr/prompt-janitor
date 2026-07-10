import type { CommonIssue, Grade, GradeCount } from "@/lib/ipc";

/** Grade → CSS custom property name carrying that grade's theme color. */
const GRADE_VAR: Record<Grade, string> = {
  A: "--grade-a",
  B: "--grade-b",
  C: "--grade-c",
  D: "--grade-d",
  F: "--grade-f",
};

export interface GradeBar {
  grade: Grade;
  count: number;
  colorVar: string;
}

/** Shapes the grade distribution for the bar chart, attaching each grade's theme token. */
export function gradeBars(distribution: GradeCount[]): GradeBar[] {
  return distribution.map(({ grade, count }) => ({
    grade,
    count,
    colorVar: GRADE_VAR[grade],
  }));
}

export interface IssueBar extends CommonIssue {
  pct: number;
}

/** Shapes common issues for a bar chart, computing each bar's width relative to the largest. */
export function issueBars(common: CommonIssue[]): IssueBar[] {
  const max = common.reduce((m, c) => Math.max(m, c.files_affected), 0);
  return common.map((issue) => ({
    ...issue,
    pct: max > 0 ? (issue.files_affected / max) * 100 : 0,
  }));
}
