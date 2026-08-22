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

/** How many series the tab considers at all — the backend's own cap on `top`. */
export const SERIES_LIMIT = SERIES_VARS.length;

/**
 * How many of those the line chart actually draws. Past five lines the reader
 * is matching hues against a legend rather than reading a trend, so the rest
 * are left to the table underneath, which lists every series.
 */
export const CHART_SERIES_LIMIT = 5;

/** Slot 1 — the single hue nominal bar charts use, since bar length carries the value. */
export const BAR_COLOR = SERIES_VARS[0];

/** Error rate is a good/bad measure, so it wears the reserved critical status colour. */
export const ERROR_BAR_COLOR = "var(--chart-critical)";

/** A row the harness never measured: neutral ink, so it makes no claim either way. */
export const UNMEASURED_BAR_COLOR = "var(--text-3)";

/** Recharts mark geometry, per the data-viz mark specs. */
export const MAX_BAR_SIZE = 24;
export const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];
export const BAR_RADIUS_HORIZONTAL: [number, number, number, number] = [0, 4, 4, 0];
export const LINE_WIDTH = 2;

/** Axis/grid ink and tick styling shared by every chart on the tab. */
export const AXIS_TICK = { fill: "var(--text-2)", fontSize: 11 } as const;
export const GRID_STROKE = "var(--sep)";
