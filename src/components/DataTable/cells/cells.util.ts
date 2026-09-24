import type { RateThresholds, RateTone } from "./cells.types";

/** How much of a long path's head survives {@link truncateMiddle}. */
export const PATH_HEAD = 24;
/** How much of a long path's tail survives — the filename end is the useful half. */
export const PATH_TAIL = 32;
/** What a cell shows when the underlying value is unknown, not zero. */
export const EMPTY_MARK = "—";
/**
 * What a Last used cell shows for an artifact nothing ever invoked. Not
 * {@link EMPTY_MARK}: the em dash means "we don't know" everywhere else in
 * these tables, and "this was never called" is an answer, not a gap.
 */
export const NEVER_MARK = "never";

const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

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

/**
 * Which band a 0–1 rate falls in: `good` under `watch`, `watch` from `watch`
 * up to just under `bad`, `bad` at `bad` and above. Both lines are inclusive
 * on their lower edge, so a rate sitting exactly on a threshold reads as the
 * worse band — the same `>=` Setup's "Errors" filter uses. Unknown stays
 * unknown rather than defaulting to good.
 *
 * Banded on the raw value, not the rounded one {@link formatPercent} shows:
 * 24.9% prints "25%" yet stays `watch`, because the "Errors" filter excludes
 * it too, and a red row the filter then hides would be the worse mismatch.
 */
export function rateTone(value: number | null | undefined, thresholds: RateThresholds): RateTone {
  if (value == null || !Number.isFinite(value)) return "unknown";
  if (value >= thresholds.bad) return "bad";
  if (value >= thresholds.watch) return "watch";
  return "good";
}

/** Groups thousands so a six-digit count is readable at a glance; unknown stays unknown. */
export function formatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return EMPTY_MARK;
  return NUMBER_FORMAT.format(value);
}

/**
 * Token counts read exactly like any other count — the separate name is kept
 * so a column's call site says what it is counting.
 */
export const formatTokens = formatCount;

/**
 * `usage.last_used` — a fixed-width UTC RFC3339 string, per Rust's
 * `rebuild_usage_stats` — as epoch milliseconds, or `null` when the artifact
 * was never used. Shared by the Last used column's sort key and its cell so
 * the two can never disagree about which rows count as never-used, and so an
 * unparseable timestamp sorts with the never-used rows instead of as `NaN`.
 */
export function lastUsedAt(lastUsed: string | null | undefined): number | null {
  if (!lastUsed) return null;
  const ms = Date.parse(lastUsed);
  return Number.isFinite(ms) ? ms : null;
}
