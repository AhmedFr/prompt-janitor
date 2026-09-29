import "./cells.css";
import type { TokensCellProps } from "./cells.types";
import { EMPTY_MARK, formatTokens } from "./cells.util";

/**
 * Right-aligned token count with thousands separators; a muted "—" when
 * unknown. `approx` prefixes a measured-looking number with "≈" — used for
 * an instruction file's size-based estimate, never a real usage rollup.
 */
export function TokensCell({ value, approx }: TokensCellProps) {
  const text = formatTokens(value);
  const isEmpty = text === EMPTY_MARK;
  return (
    <span className={isEmpty ? "dt-num muted" : "dt-num"}>
      {approx && !isEmpty ? "≈" : ""}
      {text}
    </span>
  );
}
