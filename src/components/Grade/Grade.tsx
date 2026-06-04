import type { GradeProps } from "./Grade.types";
import "./Grade.css";

/** A–F health-grade badge. The core metaphor across the whole app. */
export function Grade({ grade, size = "md", ghost = false }: GradeProps) {
  const letter = grade ?? "–";
  const colorClass = `grade--${(grade ?? "F").toLowerCase()}`;
  const className = [
    "grade",
    colorClass,
    size !== "md" ? `grade--${size}` : "",
    ghost ? "grade--ghost" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={className} aria-label={grade ? `Grade ${grade}` : "Ungraded"}>
      {letter}
    </span>
  );
}
