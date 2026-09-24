import "./cells.css";
import type { CountCellProps } from "./cells.types";
import { EMPTY_MARK, formatCount } from "./cells.util";

/**
 * Right-aligned whole count with thousands separators; a muted "—" when
 * unknown. A zero is a real answer and renders as one — only a missing value
 * is an em dash, and only the em dash recedes.
 */
export function CountCell({ value }: CountCellProps) {
  const text = formatCount(value);
  return <span className={text === EMPTY_MARK ? "dt-num muted" : "dt-num"}>{text}</span>;
}
