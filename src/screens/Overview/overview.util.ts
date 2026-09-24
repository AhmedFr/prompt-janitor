import { formatTrendX } from "@/components/TrendChart";

/**
 * The trend delta as a signed, dated phrase: "+18 since Sep 1". The window is
 * the last seven scans, not a calendar week, so the phrase names where it
 * starts rather than claiming "this week". A drop uses a true minus sign (−),
 * which sits at the same width and height as the plus.
 */
export function formatTrendDelta(delta: number, since: string | undefined): string {
  const signed = delta > 0 ? `+${delta}` : delta < 0 ? `−${-delta}` : "0";
  return since ? `${signed} since ${formatTrendX(since, "axis")}` : signed;
}
