import type { ReactNode } from "react";

/** One row in a `RankedList` — a labelled value with its bar's share of the max. */
export interface RankedRow {
  id: string;
  label: string;
  value: number;
  /** Extra value shown at the row's end, e.g. "12 uses" next to an error rate. */
  secondary?: string;
  glyph?: ReactNode;
  /** Native tooltip on the row — the full path behind a truncated label. */
  title?: string;
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

/**
 * A bar's width is `value / max`. By default `max` is the largest value among
 * the rows actually rendered — the `limit`-sliced set, not the full `rows`
 * array (see `rankRows`). Two lists fed the same `rows` but different `limit`s
 * can therefore draw the same row's bar at different widths: cutting the top
 * row out of view changes what "full width" means for everything still on
 * screen. Pass {@link RankedListProps.max} to pin the denominator instead.
 */
export interface RankedListProps {
  title: string;
  rows: RankedRow[];
  selector?: RankedListSelector;
  /** Rows shown, sorted desc by value. Defaults to 10 — also the row count `max` is computed over. */
  limit?: number;
  /**
   * Pins the denominator every bar is a share of, for values that already have
   * a natural ceiling — a 40% error rate is 40% of what can go wrong, not
   * 100% of this particular list. Ignored when `<= 0`.
   */
  max?: number;
  /** Tints the bars red for "most errors"-style lists. */
  variant?: "default" | "error";
  /** How a row's `value` renders next to its bar. Defaults to `toLocaleString`. */
  format?: (v: number) => string;
  details?: RankedListDetails;
  /** Copy shown when `rows` is empty. */
  empty: string;
}
