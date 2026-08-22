import "./cells.css";
import type { PercentCellProps } from "./cells.types";
import { formatPercent } from "./cells.util";

/** Right-aligned percentage from a 0–1 fraction; "—" when unknown. */
export function PercentCell({ value }: PercentCellProps) {
  return <span className="dt-num">{formatPercent(value)}</span>;
}
