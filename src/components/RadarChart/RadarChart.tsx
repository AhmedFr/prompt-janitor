import {
  Radar,
  RadarChart as RC,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import type { RadarChartProps } from "./RadarChart.types";

/** Abbreviated axis labels for the five scoring dimensions. */
const SHORT: Record<string, string> = {
  Consistency: "Consist.",
  Format: "Format",
  Clarity: "Clarity",
  Structure: "Structure",
  Examples: "Examples",
};

/** Grade → CSS custom property carrying that grade's theme color. */
const GRADE_VAR: Record<string, string> = {
  A: "--grade-a",
  B: "--grade-b",
  C: "--grade-c",
  D: "--grade-d",
  F: "--grade-f",
};

/** Radar/spider chart of per-dimension scores, themed to the file's grade color. */
export function RadarChart({ data, grade, size = 240 }: RadarChartProps) {
  const color =
    getComputedStyle(document.documentElement).getPropertyValue(GRADE_VAR[grade]).trim() || "#f59e0b";
  const chartData = data.map((d) => ({ dim: SHORT[d.dimension] ?? d.dimension, score: d.score }));

  return (
    <div style={{ width: "100%", height: size }} role="img" aria-label="Dimension scorecard">
      <ResponsiveContainer>
        <RC data={chartData} outerRadius="72%">
          <PolarGrid stroke="var(--sep-strong)" />
          <PolarAngleAxis dataKey="dim" tick={{ fill: "var(--text-2)", fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar dataKey="score" stroke={color} fill={color} fillOpacity={0.35} isAnimationActive />
        </RC>
      </ResponsiveContainer>
    </div>
  );
}
