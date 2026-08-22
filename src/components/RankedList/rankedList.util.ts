import type { RankedRow } from "./RankedList.types";

export interface RankResult {
  rows: RankedRow[];
  max: number;
}

/**
 * Rows sorted desc by value and sliced to `limit`. `max` is the largest value
 * in the slice — because the input is sorted first, that's always the first
 * row's value (0 when the slice is empty), the denominator every bar's width
 * is a share of.
 */
export function rankRows(rows: RankedRow[], limit: number): RankResult {
  const sorted = [...rows].sort((a, b) => b.value - a.value).slice(0, Math.max(0, limit));
  const max = sorted[0]?.value ?? 0;
  return { rows: sorted, max };
}
