import type {
  InvocationKind,
  KindTotal,
  ProjectSessions,
  RankedTarget,
  UsageOverview,
} from "@/lib/ipc";
import type { RankedRow } from "@/components/RankedList";
import { KIND_LABEL, rankedKey } from "@/lib/usage";
// A deep import rather than the screen barrel: `plural` is a pure formatter,
// and the barrel would pull a whole screen in behind it.
import { plural } from "@/screens/Setup/setup.util";
import type { KindBar, RankedBy, SessionBar } from "./UsageTab.types";
import { MAX_PROJECT_BARS } from "./UsageTab.constants";

/**
 * How copy names the reporting window: `30` → `last 30 days`.
 *
 * Every aggregate is bounded by the same window and the backend echoes it
 * back, so the tab can say which period it means instead of leaving the reader
 * to guess at "the window".
 */
export function windowLabel(windowDays: number): string {
  return windowDays === 1 ? "last day" : `last ${windowDays} days`;
}

/** Pins a piece of empty copy to the window that produced it. */
export function inWindow(text: string, windowDays: number): string {
  return `${text} in the ${windowLabel(windowDays)}.`;
}

/** `12.5` → `12.5%`, `50` → `50%` — a whole percentage carries no false precision. */
export function percentValue(pct: number): string {
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}

/** Context tokens as they read next to a bar: whole tokens, grouped. */
export function tokenValue(tokens: number): string {
  return Math.round(tokens).toLocaleString();
}

/**
 * The numbers a ranked row's single bar cannot carry, for its hover: the
 * sessions it spans, how often it failed, and what a turn cost.
 *
 * A `null` on either measure says the harness recorded none, which is not the
 * same claim as a clean 0% or a free turn — so it is said, not zeroed.
 */
export function targetDetail(row: RankedTarget): string {
  return [
    plural(row.sessions, "session"),
    row.error_rate === null
      ? "error rate not measured"
      : `${percentValue(errorPct(row.error_rate))} errors`,
    row.avg_turn_tokens === null
      ? "avg tokens not recorded"
      : `${tokenValue(row.avg_turn_tokens)} avg tokens`,
  ].join(" · ");
}

/** A 0–1 rate as a percentage, rounded to the one decimal the list shows. */
function errorPct(rate: number): number {
  return Math.round(rate * 1000) / 10;
}

/**
 * The ranked rows one list shows: the targets of `kind` (or every kind),
 * ordered by `by` and cut to `limit`.
 *
 * Two exclusions, both because a zero would be a claim the data does not
 * make: an error-free (or never-measured) target is not an error finding, and
 * a target with no recorded token average has no cost to rank — showing
 * either as `0` pushes a real finding off the list and reads as a clean bill
 * of health for a row nobody measured.
 *
 * The sort is stable, so targets tied on a value keep the backend's own
 * busiest-first order rather than shuffling between renders.
 *
 * Ranks all of them: how many rows fit on screen is `RankedList`'s `limit`,
 * the one place the tab states it, so the two cannot drift into cutting at
 * different depths. `limit` here is for a caller that needs a hard cut of its
 * own — it defaults to no cut, not to a second opinion on the display depth.
 */
export function rankedFor(
  ranked: RankedTarget[],
  kind: InvocationKind | "all",
  by: RankedBy,
  limit?: number,
): RankedRow[] {
  return ranked
    .filter((row) => (kind === "all" || row.kind === kind) && measured(row, by))
    .map((row) => ({
      id: rankedKey(row),
      label: row.target,
      value: valueOf(row, by),
      secondary: by === "uses" ? plural(row.sessions, "session") : plural(row.uses, "use"),
      title: targetDetail(row),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit === undefined ? undefined : Math.max(0, limit));
}

/** Whether this row has the measure the list ranks on. */
function measured(row: RankedTarget, by: RankedBy): boolean {
  if (by === "errors") return row.error_rate !== null && row.error_rate > 0;
  if (by === "tokens") return row.avg_turn_tokens !== null;
  return true;
}

/** Only ever called on a row {@link measured} already vouched for. */
function valueOf(row: RankedTarget, by: RankedBy): number {
  if (by === "errors") return errorPct(row.error_rate ?? 0);
  if (by === "tokens") return row.avg_turn_tokens ?? 0;
  return row.uses;
}

/** Shapes windowed kind totals for the bar chart and its token tooltip. */
export function kindBars(byKind: KindTotal[]): KindBar[] {
  return byKind.map(({ kind, total, avg_turn_tokens }) => ({
    kind,
    label: KIND_LABEL[kind],
    total,
    avgTurnTokens: avg_turn_tokens === null ? null : Math.round(avg_turn_tokens),
  }));
}

/** The busiest projects by session count — zero-session projects dropped. */
export function sessionBars(projects: ProjectSessions[]): SessionBar[] {
  return projects
    .filter((p) => p.sessions > 0)
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, MAX_PROJECT_BARS);
}

/**
 * True when the window holds no usage at all — the tab's empty state.
 *
 * `by_kind` always carries its four legend rows, so an empty window shows up
 * as four zero totals rather than as a missing array.
 */
export function isUsageEmpty(data: UsageOverview): boolean {
  return (
    data.ranked.length === 0 &&
    data.by_kind.every((k) => k.total === 0) &&
    data.sessions_per_project.length === 0 &&
    data.mcp_error_rates.length === 0
  );
}
