import type { InvocationKind, ProjectSessions, UsageOverview } from "@/lib/ipc";

/** One day of the top-targets chart: the day plus one numeric column per series. */
export type StackedRow = Record<string, number | string>;

/**
 * One line of the top-targets chart. The backend groups usage by
 * `(kind, target)`, so `key` — not the bare target — is what identifies a
 * column: a skill and an agent can share a name.
 */
export interface SeriesColumn {
  /** `${kind}:${target}` — the chart column, React key and `dataKey`. */
  key: string;
  /** The bare target, with the kind appended only when the name collides. */
  label: string;
  kind: InvocationKind;
  target: string;
  total: number;
  errors: number;
}

/** A bar in the "Invocations by kind" chart. */
export interface KindBar {
  kind: InvocationKind;
  /** Human label — `Skills / Agents / MCP / Built-in`. */
  label: string;
  total: number;
  /** Mean context tokens per turn, rounded; `null` when the harness recorded none. */
  avgTurnTokens: number | null;
}

/** A bar in the "MCP error rate" chart, as a 0–100 percentage. */
export interface ErrorRateBar {
  target: string;
  total: number;
  pct: number;
  /** False when the harness recorded no outcome — the bar is greyed, not zero. */
  measured: boolean;
}

/** A bar in the "Sessions per project" chart — the IPC row, filtered and ranked. */
export type SessionBar = ProjectSessions;

/** One line of a chart tooltip; the colour dot (not the text) carries identity. */
export interface TipLine {
  text: string;
  color?: string;
}

/** Presentational half of the tab — rendered from data the hook already loaded. */
export interface UsageTabBodyProps {
  data: UsageOverview;
}
