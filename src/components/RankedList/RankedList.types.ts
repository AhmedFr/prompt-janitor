import type { ReactNode } from "react";

/** One row in a `RankedList` — a labelled value with its bar's share of the max. */
export interface RankedRow {
  id: string;
  label: string;
  value: number;
  /** Extra value shown at the row's end, e.g. "12 uses" next to an error rate. */
  secondary?: string;
  glyph?: ReactNode;
  /** Makes the row a button — e.g. opening the matching Setup row. */
  onClick?: () => void;
}

/** Chips above the list that switch which kind of row it's ranking. */
export interface RankedListSelector {
  options: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}

/** The link at the bottom that opens the fuller view this list summarizes. */
export interface RankedListDetails {
  label: string;
  onClick: () => void;
}

export interface RankedListProps {
  title: string;
  rows: RankedRow[];
  selector?: RankedListSelector;
  /** Rows shown, sorted desc by value. Defaults to 10. */
  limit?: number;
  /** Tints the bars red for "most errors"-style lists. */
  variant?: "default" | "error";
  /** How a row's `value` renders next to its bar. Defaults to `toLocaleString`. */
  format?: (v: number) => string;
  details?: RankedListDetails;
  /** Copy shown when `rows` is empty. */
  empty: string;
}
