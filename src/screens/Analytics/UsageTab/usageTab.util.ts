import type {
  InvocationKind,
  KindTotal,
  ProjectSessions,
  RankedTarget,
  TargetRate,
  UsageOverview,
} from "@/lib/ipc";
import type { ErrorRateBar, KindBar, SessionBar } from "./UsageTab.types";
import { KIND_LABEL, MAX_PROJECT_BARS, MONTHS, RANKED_LIMIT } from "./UsageTab.constants";

/**
 * The key for a ranked row. Usage is grouped by `(kind, target)`, so a skill
 * and an agent may share a target name and must stay separate rows.
 */
export function rankedKey(row: Pick<RankedTarget, "kind" | "target">): string {
  return `${row.kind}:${row.target}`;
}

/** The busiest targets in the window — the backend already ordered them. */
export function topRanked(ranked: RankedTarget[]): RankedTarget[] {
  return ranked.slice(0, RANKED_LIMIT);
}

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

/** Invocation kind → the label the UI shows for it. */
export function kindLabel(kind: InvocationKind): string {
  return KIND_LABEL[kind];
}

/** `2026-08-02` → `Aug 2`, parsed by hand so the local time zone can't shift it. */
export function shortDay(day: string): string {
  const [, month, date] = day.split("-");
  const name = MONTHS[Number(month) - 1];
  return name ? `${name} ${Number(date)}` : day;
}

/** Shapes all-time kind totals for the bar chart and its token tooltip. */
export function kindBars(byKind: KindTotal[]): KindBar[] {
  return byKind.map(({ kind, total, avg_turn_tokens }) => ({
    kind,
    label: kindLabel(kind),
    total,
    avgTurnTokens: avg_turn_tokens === null ? null : Math.round(avg_turn_tokens),
  }));
}

/**
 * Converts each MCP server's 0–1 error rate into a 0–100 percentage bar.
 *
 * A `null` rate means the harness never recorded an outcome for that server,
 * which is not the same claim as "0% of its calls failed". The row keeps its
 * place in the chart — dropping it would hide a server entirely — but says it
 * is unmeasured so the chart can grey it out instead of vouching for it.
 */
export function errorRateBars(rates: TargetRate[]): ErrorRateBar[] {
  return rates.map(({ target, total, error_rate }) => ({
    target,
    total,
    pct: (error_rate ?? 0) * 100,
    measured: error_rate !== null,
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
