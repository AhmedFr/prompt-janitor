import type {
  InvocationKind,
  KindTotal,
  ProjectSessions,
  TargetRate,
  UsageOverview,
  UsageSeries,
} from "@/lib/ipc";
import type { ErrorRateBar, KindBar, SeriesColumn, SessionBar, StackedRow } from "./UsageTab.types";
import { KIND_LABEL, MAX_PROJECT_BARS, MONTHS } from "./UsageTab.constants";

/**
 * The column key for a series. Usage is grouped by `(kind, target)`, so a
 * skill and an agent may share a target name and must stay separate columns.
 */
export function seriesKey(series: Pick<UsageSeries, "kind" | "target">): string {
  return `${series.kind}:${series.target}`;
}

/**
 * Describes each line of the top-targets chart. Labels stay as short as the
 * data allows: the bare target name, with the kind appended only where two
 * kinds share that name.
 */
export function seriesColumns(top: UsageSeries[]): SeriesColumn[] {
  const seen = new Map<string, number>();
  for (const series of top) seen.set(series.target, (seen.get(series.target) ?? 0) + 1);

  return top.map((series) => ({
    key: seriesKey(series),
    label: (seen.get(series.target) ?? 0) > 1 ? `${series.target} (${series.kind})` : series.target,
    kind: series.kind,
    target: series.target,
    total: sum(series.points.map((p) => p.count)),
    errors: sum(series.points.map((p) => p.errors)),
  }));
}

/**
 * Pivots per-target day series into chart rows: one row per day across the
 * union of every series' days (ascending), one numeric column per
 * `kind:target`, zero-filled where a series has no invocations that day.
 */
export function toStackedSeries(top: UsageSeries[]): StackedRow[] {
  const days = [...new Set(top.flatMap((s) => s.points.map((p) => p.day)))].sort();
  const rows = new Map<string, StackedRow>(
    days.map((day) => [
      day,
      { day, ...Object.fromEntries(top.map((s) => [seriesKey(s), 0])) } as StackedRow,
    ]),
  );

  for (const series of top) {
    const key = seriesKey(series);
    for (const point of series.points) {
      const row = rows.get(point.day);
      if (row) row[key] = (row[key] as number) + point.count;
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
export function sessionBars(projects: ProjectSessions[]): SessionBar[] {
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

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
