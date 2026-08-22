import type { GradeLetter, GradeProps } from "./Grade.types";
import { GRADE_LETTERS, UNGRADED_MARK } from "./Grade.constants";
import "./Grade.css";

const isLetter = (g: unknown): g is GradeLetter =>
  typeof g === "string" && (GRADE_LETTERS as readonly string[]).includes(g);

/**
 * A–F health-grade badge. The core metaphor across the whole app.
 *
 * "No grade" is its own state, not a bad grade: an ungraded artifact renders a
 * neutral chip, because painting it in the F colour told the user something
 * the grader never said.
 */
export function Grade({ grade, size = "md", ghost = false }: GradeProps) {
  const letter = isLetter(grade) ? grade : null;
  const className = [
    "grade",
    letter ? `grade--${letter.toLowerCase()}` : "grade--none",
    size !== "md" ? `grade--${size}` : "",
    ghost ? "grade--ghost" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={className} aria-label={letter ? `Grade ${letter}` : "Ungraded"}>
      {letter ?? UNGRADED_MARK}
    </span>
  );
}
