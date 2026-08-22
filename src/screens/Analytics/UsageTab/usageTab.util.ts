import type {
  InvocationKind,
  KindTotal,
  ProjectSessions,
  TargetRate,
  UsageOverview,
  UsageSeries,
} from "@/lib/ipc";
import type { ErrorRateBar, KindBar, StackedRow } from "./UsageTab.types";
import { KIND_LABEL, MAX_PROJECT_BARS, MONTHS } from "./UsageTab.constants";

/**
 * Pivots per-target day series into chart rows: one row per day across the
 * union of every series' days (ascending), one numeric column per target,
 * zero-filled where a target has no invocations that day.
 */
export function toStackedSeries(top: UsageSeries[]): StackedRow[] {
  const days = [...new Set(top.flatMap((s) => s.points.map((p) => p.day)))].sort();
  const rows = new Map<string, StackedRow>(
    days.map((day) => [
      day,
      { day, ...Object.fromEntries(top.map((s) => [s.target, 0])) } as StackedRow,
    ]),
  );

  for (const series of top) {
    for (const point of series.points) {
      const row = rows.get(point.day);
      if (row) row[series.target] = (row[series.target] as number) + point.count;
    }
  }

  return days.map((day) => rows.get(day) as StackedRow);
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

/** Converts each MCP server's 0–1 error rate into a 0–100 percentage bar. */
export function errorRateBars(rates: TargetRate[]): ErrorRateBar[] {
  return rates.map(({ target, total, error_rate }) => ({
    target,
    total,
    pct: (error_rate ?? 0) * 100,
  }));
}

/** The busiest projects by session count — zero-session projects dropped. */
export function sessionBars(projects: ProjectSessions[]): ProjectSessions[] {
  return projects
    .filter((p) => p.sessions > 0)
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, MAX_PROJECT_BARS);
}

/** True when the harness index holds no usage at all — the tab's empty state. */
export function isUsageEmpty(data: UsageOverview): boolean {
  return (
    data.top.length === 0 &&
    data.by_kind.length === 0 &&
    data.sessions_per_project.length === 0 &&
    data.mcp_error_rates.length === 0
  );
}
