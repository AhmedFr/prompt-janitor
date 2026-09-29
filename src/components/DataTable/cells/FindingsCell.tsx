import "./cells.css";
import type { FindingsCellProps } from "./cells.types";
import { EMPTY_MARK } from "./cells.util";

const SEVERITY_WORD = { hi: "critical", mid: "warning", lo: "nit" } as const;

/** Open findings on an item, tinted by the worst one; "—" when there are none or it is not graded. */
export function FindingsCell({ count, severity }: FindingsCellProps) {
  if (!count) return <span className="dt-num muted">{EMPTY_MARK}</span>;
  const word = severity ? SEVERITY_WORD[severity] : "warning";
  return (
    <span
      className="dt-findings"
      data-severity={severity ?? "mid"}
      aria-label={`${count} finding${count === 1 ? "" : "s"}, worst ${word}`}
    >
      {count}
    </span>
  );
}
