import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { TrendChartProps } from "./TrendChart.types";

/**
 * Area chart of a single series over time, themed with the shell's blue
 * token. Defaults to the overall-score trend it was written for; the key,
 * domain and label props let a count series (sessions per day) reuse it
 * without a second chart component drifting away from this one's theming.
 */
export function TrendChart<Point extends object>({
  data,
  height = 180,
  xKey = "t",
  dataKey = "score",
  domain = [0, 100],
  ariaLabel = "Health trend",
}: TrendChartProps<Point>) {
  return (
    <div style={{ width: "100%", height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <XAxis dataKey={xKey} hide />
          <YAxis domain={domain} hide />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke="var(--blue)"
            fill="var(--blue-tint)"
            strokeWidth={2}
            isAnimationActive
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
