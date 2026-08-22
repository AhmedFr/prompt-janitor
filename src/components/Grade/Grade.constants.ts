import type { GradeLetter } from "./Grade.types";

/** Every grade the scorer can write. Anything else is treated as ungraded. */
export const GRADE_LETTERS: readonly GradeLetter[] = ["A", "B", "C", "D", "F"] as const;

/** What an ungraded chip shows: an em dash, never a letter. */
export const UNGRADED_MARK = "—";
