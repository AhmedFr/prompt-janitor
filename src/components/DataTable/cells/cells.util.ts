/** How much of a long path's head survives {@link truncateMiddle}. */
export const PATH_HEAD = 24;
/** How much of a long path's tail survives — the filename end is the useful half. */
export const PATH_TAIL = 32;
/** What a cell shows when the underlying value is unknown, not zero. */
export const EMPTY_MARK = "—";

const TOKEN_FORMAT = new Intl.NumberFormat("en-US");

/**
 * Shortens a path from the middle, keeping the root context and the filename.
 * Done in JS rather than with a CSS `direction: rtl` trick so the rendered
 * text is what a screen reader and a copy/paste both get, and so the ellipsis
 * lands at a predictable, testable offset.
 */
export function truncateMiddle(path: string): string {
  if (path.length <= PATH_HEAD + PATH_TAIL + 1) return path;
  return `${path.slice(0, PATH_HEAD)}…${path.slice(-PATH_TAIL)}`;
}

/** Renders a 0–1 fraction as a whole percentage; unknown stays unknown. */
export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return EMPTY_MARK;
  return `${Math.round(value * 100)}%`;
}

/** Groups thousands so a six-digit token count is readable at a glance. */
export function formatTokens(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return EMPTY_MARK;
  return TOKEN_FORMAT.format(value);
}
