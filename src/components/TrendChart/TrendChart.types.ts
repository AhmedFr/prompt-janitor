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
  /**
   * One extra tooltip line derived from the hovered value — the grade a
   * score maps to, say. Omitted, the tooltip shows the value and date only.
   */
  valueDetail?: (value: number) => string;
}

/** Props Recharts hands a custom tooltip, plus the keys the chart plots. */
export interface TrendTooltipProps {
  active?: boolean;
  /** Recharts' payload entries; only the first entry's row (`payload`) is read. */
  payload?: ReadonlyArray<{ payload?: unknown }>;
  xKey: string;
  dataKey: string;
  valueDetail?: (value: number) => string;
}

/** What Recharts passes a custom `dot` renderer, plus which index is the latest point. */
export interface TrendEndDotProps {
  index?: number;
  lastIndex: number;
  cx?: number;
  cy?: number;
}
