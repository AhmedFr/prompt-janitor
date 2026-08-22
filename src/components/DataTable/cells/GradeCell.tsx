import { Grade } from "@/components/Grade";
import type { GradeCellProps } from "./cells.types";

/** Row-sized grade chip. Ungraded stays neutral — see `Grade`. */
export function GradeCell({ grade }: GradeCellProps) {
  return <Grade grade={grade} size="sm" />;
}
