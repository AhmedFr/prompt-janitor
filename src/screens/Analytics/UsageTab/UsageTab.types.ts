import type { InvocationKind, UsageOverview } from "@/lib/ipc";

/** One day of the top-targets chart: the day plus one numeric column per target. */
export type StackedRow = Record<string, number | string>;

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
}

/** Presentational half of the tab — rendered from data the hook already loaded. */
export interface UsageTabBodyProps {
  data: UsageOverview;
}
