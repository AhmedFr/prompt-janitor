import "./cells.css";
import type { TokensCellProps } from "./cells.types";
import { formatTokens } from "./cells.util";

/** Right-aligned token count with thousands separators; "—" when unknown. */
export function TokensCell({ value }: TokensCellProps) {
  return <span className="dt-num">{formatTokens(value)}</span>;
}
