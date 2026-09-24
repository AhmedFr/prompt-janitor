import type { TrendTooltipProps } from "./TrendChart.types";
import { formatTrendX } from "./trendChart.util";

/**
 * The hover readout for one point: the value leads, strong, and the date
 * follows muted — the reader already knows the series (the card's title names
 * it) and wants the number. `valueDetail` adds one line of meaning the number
 * alone does not carry, such as the grade a score maps to.
 */
export function TrendTooltip({ active, payload, xKey, dataKey, valueDetail }: TrendTooltipProps) {
  const row = payload?.[0]?.payload as Record<string, unknown> | undefined;
  if (!active || !row) return null;

  const value = Number(row[dataKey]);
  const x = row[xKey];
  return (
    <div className="trend-tip">
      <div className="trend-tip__value">{value.toLocaleString("en-US")}</div>
      {valueDetail && <div className="trend-tip__detail">{valueDetail(value)}</div>}
      {x !== undefined && (
        <div className="trend-tip__label">{formatTrendX(x as string | number, "tooltip")}</div>
      )}
    </div>
  );
}
