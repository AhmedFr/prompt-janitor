import "./cells.css";
import type { TokensCellProps } from "./cells.types";
import { EMPTY_MARK, formatTokens } from "./cells.util";

/** Right-aligned token count with thousands separators; a muted "—" when unknown. */
export function TokensCell({ value }: TokensCellProps) {
  const text = formatTokens(value);
  return <span className={text === EMPTY_MARK ? "dt-num muted" : "dt-num"}>{text}</span>;
}
