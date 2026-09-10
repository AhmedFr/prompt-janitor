import "./cells.css";
import { relativeTime } from "@/lib/format";
import type { LastUsedCellProps } from "./cells.types";
import { lastUsedAt, NEVER_MARK } from "./cells.util";

/** Milliseconds per second — `relativeTime` speaks epoch seconds, `last_used` is RFC3339. */
const MS_PER_SEC = 1000;

/**
 * When an artifact was last invoked, as the app's short relative age ("3h",
 * "2d"). Never-used rows say "never" rather than "—" (see {@link NEVER_MARK}),
 * muted so a column of them reads as background rather than as a column of
 * findings.
 */
export function LastUsedCell({ lastUsed }: LastUsedCellProps) {
  const at = lastUsedAt(lastUsed);
  if (at === null) return <span className="dt-num muted">{NEVER_MARK}</span>;
  return <span className="dt-num">{relativeTime(String(Math.floor(at / MS_PER_SEC)))}</span>;
}
