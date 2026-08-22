import type { InvocationKind } from "@/lib/ipc";

/** Invocation kind → the label the UI shows for it. */
export const KIND_LABEL: Record<InvocationKind, string> = {
  skill: "Skills",
  agent: "Agents",
  mcp: "MCP",
  builtin: "Built-in",
};

/** Month abbreviations for the day axis (`YYYY-MM-DD` → `Aug 2`). */
export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** "Sessions per project" shows at most this many bars. */
export const MAX_PROJECT_BARS = 10;

/**
 * Categorical series slots, in the fixed CVD-safe order (see `tokens.css`).
 * Assigned in sequence and never cycled — the backend caps `top` at eight,
 * and `SERIES_LIMIT` keeps the chart honest if that ever changes.
 */
export const SERIES_VARS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
] as const;

/** How many lines the top-targets chart will draw. */
export const SERIES_LIMIT = SERIES_VARS.length;

/** Slot 1 — the single hue nominal bar charts use, since bar length carries the value. */
export const BAR_COLOR = SERIES_VARS[0];

/** Error rate is a good/bad measure, so it wears the reserved critical status colour. */
export const ERROR_BAR_COLOR = "var(--chart-critical)";

/** Recharts mark geometry, per the data-viz mark specs. */
export const MAX_BAR_SIZE = 24;
export const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];
export const BAR_RADIUS_HORIZONTAL: [number, number, number, number] = [0, 4, 4, 0];
export const LINE_WIDTH = 2;

/** Axis/grid ink and tick styling shared by every chart on the tab. */
export const AXIS_TICK = { fill: "var(--text-2)", fontSize: 11 } as const;
export const GRID_STROKE = "var(--sep)";
