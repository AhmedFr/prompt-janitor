import { useId } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ACTIVE_DOT_RADIUS,
  RING_WIDTH,
  X_TICK_MIN_GAP,
  Y_AXIS_WIDTH,
} from "./TrendChart.constants";
import type { TrendChartProps } from "./TrendChart.types";
import { TrendEndDot } from "./TrendEndDot";
import { TrendTooltip } from "./TrendTooltip";
import { formatTrendX, ticksForDomain } from "./trendChart.util";
import "./TrendChart.css";

/** Axis text: secondary ink at 11px, never the series colour. */
const TICK = { fill: "var(--text-2)", fontSize: 11 };

/**
 * Area chart of a single series over time, themed with the shell's blue
 * token. Defaults to the overall-score trend it was written for; the key,
 * domain and label props let a count series (sessions per day) reuse it
 * without a second chart component drifting away from this one's theming.
 *
 * Recessive frame, loud data: hairline horizontal gridlines, dated x labels,
 * a y axis with a few clean ticks, a 2px line over a faint wash, one ringed
 * dot on the latest point, and a crosshair tooltip. Everything is drawn by
 * Recharts at the container's real size, so nothing stretches — the old
 * `Sparkline` in a `preserveAspectRatio="none"` viewBox turned its end dot
 * into an ellipse.
 */
export function TrendChart<Point extends object>({
  data,
  height = 180,
  xKey = "t",
  dataKey = "score",
  domain = [0, 100],
  ariaLabel = "Health trend",
  valueDetail,
}: TrendChartProps<Point>) {
  const gradientId = `trend-fill-${useId().replace(/:/g, "")}`;
  const lastIndex = data.length - 1;

  return (
    <div className="trend-chart" style={{ height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--blue)" stopOpacity={0.16} />
              <stop offset="1" stopColor="var(--blue)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--sep)" />
          <XAxis
            dataKey={xKey}
            tickFormatter={(x: string | number) => formatTrendX(x, "axis")}
            tick={TICK}
            tickLine={false}
            axisLine={{ stroke: "var(--sep-strong)" }}
            minTickGap={X_TICK_MIN_GAP}
            interval="preserveStartEnd"
            tickMargin={6}
          />
          <YAxis
            domain={domain}
            ticks={ticksForDomain(domain)}
            tick={TICK}
            tickLine={false}
            axisLine={false}
            width={Y_AXIS_WIDTH}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ stroke: "var(--sep-strong)", strokeWidth: 1 }}
            isAnimationActive={false}
            content={(props) => (
              <TrendTooltip
                active={props.active}
                payload={props.payload}
                xKey={xKey}
                dataKey={dataKey}
                valueDetail={valueDetail}
              />
            )}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke="var(--blue)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={`url(#${gradientId})`}
            dot={(props: { index?: number; cx?: number; cy?: number }) => (
              <TrendEndDot key={props.index} index={props.index} lastIndex={lastIndex} cx={props.cx} cy={props.cy} />
            )}
            activeDot={{
              r: ACTIVE_DOT_RADIUS,
              fill: "var(--blue)",
              stroke: "var(--card)",
              strokeWidth: RING_WIDTH,
            }}
            // No draw-in: the end dot renders at once while the line sweeps
            // towards it, so mid-animation the latest point floats detached —
            // and a rescan would replay the sweep every time the data refetches.
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
