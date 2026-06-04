import type { GradeLetter } from "@/components/Grade";

/** Maps a grade letter to its CSS color variable name. */
export const GRADE_COLOR_VAR: Record<GradeLetter, string> = {
  A: "--grade-a",
  B: "--grade-b",
  C: "--grade-c",
  D: "--grade-d",
  F: "--grade-f",
};
