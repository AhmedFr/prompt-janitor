import type { InvocationKind } from "@/lib/ipc";

/** "Sessions per project" shows at most this many bars. */
export const MAX_PROJECT_BARS = 10;

/** Categorical series slots, in the fixed CVD-safe order (see `tokens.css`). */
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

/** How many rows each ranked list shows. */
export const RANKED_LIMIT = 10;

/** Slot 1 — the single hue nominal bar charts use, since bar length carries the value. */
export const BAR_COLOR = SERIES_VARS[0];

/** Recharts mark geometry, per the data-viz mark specs. */
export const MAX_BAR_SIZE = 24;
export const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];

/** Axis/grid ink and tick styling shared by every chart on the tab. */
export const AXIS_TICK = { fill: "var(--text-2)", fontSize: 11 } as const;
export const GRID_STROKE = "var(--sep)";

/** The three ranked lists, and the link out of the first one. */
export const USED_TITLE = "Top used";
export const ERRORS_TITLE = "Most errors";
export const EXPENSIVE_TITLE = "Most expensive";
export const DETAILS_LABEL = "Details";

/** An error rate is a share of what can go wrong, not of this list's worst row. */
export const ERROR_RATE_MAX = 100;

/** The two charts that survive the ranked lists, windowed by the same call. */
export const KIND_CHART_TITLE = "Invocations by kind";
export const SESSIONS_CHART_TITLE = "Sessions per project";

/** Nothing at all ran in the window — see {@link KIND_EMPTY} for the narrower claim. */
export const NOTHING_INVOKED = "Nothing was invoked";

/**
 * The window held *something*, but nothing of the kind on screen. The blanket
 * "nothing was invoked" would be a lie in that case, and would send the reader
 * looking for a scan that already ran.
 */
export const KIND_EMPTY: Record<InvocationKind, string> = {
  skill: "No skills were invoked",
  agent: "No agents were invoked",
  mcp: "No MCP tools were called",
  builtin: "No built-in tools were used",
};

/** A clean window and an unmeasured one are different findings, said differently. */
export const NO_ERRORS = "No errors recorded";
export const NO_TOKENS = "No token averages recorded";

/** The whole tab has nothing to draw — the index itself is empty. */
export const NOT_INDEXED = "No usage indexed yet — run a scan";
export const LOADING = "Loading…";
export const KIND_CHART_EMPTY = "Nothing invoked yet.";
export const SESSIONS_CHART_EMPTY = "No sessions recorded.";
