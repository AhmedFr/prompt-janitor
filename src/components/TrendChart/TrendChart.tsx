import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { TrendChartProps } from "./TrendChart.types";

/** Area chart of the overall-score trend, themed with the shell's blue token. */
export function TrendChart({ data, height = 180 }: TrendChartProps) {
  return (
    <div style={{ width: "100%", height }} role="img" aria-label="Health trend">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <XAxis dataKey="t" hide />
          <YAxis domain={[0, 100]} hide />
          <Area
            type="monotone"
            dataKey="score"
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
