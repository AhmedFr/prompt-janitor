import type { GradeLetter } from "@/components/Grade";

/** Maps a grade letter to its CSS color variable name. */
export const GRADE_COLOR_VAR: Record<GradeLetter, string> = {
  A: "--grade-a",
  B: "--grade-b",
  C: "--grade-c",
  D: "--grade-d",
  F: "--grade-f",
};

/**
 * The grade letter's share of the diameter. 0.27 reproduces the 32 px letter
 * the 120 px ring has always drawn, and keeps that proportion at every other
 * size instead of spilling a fixed 32 px over a 56 px circle.
 */
export const LETTER_RATIO = 0.27;

/** The "86/100" line's share of the diameter — 12 px inside the 120 px ring. */
export const SCORE_RATIO = 0.1;

/**
 * Floor for the score line. The ratio alone puts it at 8 px inside the project
 * header's 78 px ring, which is smaller than any type the app sets anywhere;
 * the line is there to be read, so it stops shrinking here.
 */
export const SCORE_MIN_FONT_SIZE = 10;

/**
 * Below this diameter the score line is dropped rather than shrunk: under
 * ~7 px it is unreadable, and stacked under the letter it pushes both past the
 * ring's stroke. The letter alone still answers "how good is this?".
 */
export const SCORE_LINE_MIN_SIZE = 72;
