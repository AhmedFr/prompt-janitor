import "./cells.css";
import type { CountCellProps } from "./cells.types";
import { formatCount } from "./cells.util";

/**
 * Right-aligned whole count with thousands separators; "—" when unknown.
 * A zero is a real answer and renders as one — only a missing value is
 * an em dash.
 */
export function CountCell({ value }: CountCellProps) {
  return <span className="dt-num">{formatCount(value)}</span>;
}
