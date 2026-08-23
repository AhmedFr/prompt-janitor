import type { TrendPoint } from "@/lib/ipc";

/** What Recharts accepts for a `YAxis` bound: a number, or a keyword it resolves from the data. */
export type TrendDomainBound = number | "auto" | "dataMin" | "dataMax";

/**
 * Generic over the point so a second series (sessions per day, `DayCount`)
 * can reuse the chart without being cast into the score trend's shape.
 * Defaults keep the original call sites (`<TrendChart data={trend} />`)
 * unchanged: a `TrendPoint[]` on a 0–100 axis, labelled "Health trend".
 */
export interface TrendChartProps<Point = TrendPoint> {
  data: Point[];
  height?: number;
  /** Field the x axis reads. Defaults to `t`. */
  xKey?: string;
  /** Field the area plots. Defaults to `score`. */
  dataKey?: string;
  /**
   * Y-axis bounds. Defaults to `[0, 100]` — right for a score, wrong for a
   * count, which has no ceiling and needs `[0, "auto"]`.
   */
  domain?: [TrendDomainBound, TrendDomainBound];
  /**
   * Accessible name. The chart is one `role="img"`, so this is the entire
   * description a screen reader gets — two charts on a page must not both
   * claim to be the health trend.
   */
  ariaLabel?: string;
}
