export type GradeLetter = "A" | "B" | "C" | "D" | "F";

export type GradeSize = "sm" | "md" | "lg" | "xl";

export interface GradeProps {
  /** Letter grade; `null`/`undefined` renders an ungraded placeholder. */
  grade: GradeLetter | null | undefined;
  /** Visual size. Defaults to `md`. */
  size?: GradeSize;
  /** Outline style instead of a filled tile. */
  ghost?: boolean;
}
