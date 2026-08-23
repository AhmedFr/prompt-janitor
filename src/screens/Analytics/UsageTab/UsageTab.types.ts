import type { InvocationKind, ProjectSessions, UsageOverview } from "@/lib/ipc";
import type { Navigate } from "@/App/App.types";

/** What a ranked list orders its targets by. */
export type RankedBy = "uses" | "errors" | "tokens";

/** A bar in the "Invocations by kind" chart. */
export interface KindBar {
  kind: InvocationKind;
  /** Human label — `Skills / Agents / MCP / Built-in`. */
  label: string;
  total: number;
  /** Mean context tokens per turn, rounded; `null` when the harness recorded none. */
  avgTurnTokens: number | null;
}

/** A bar in the "Sessions per project" chart — the IPC row, filtered and ranked. */
export type SessionBar = ProjectSessions;

/** The tab, windowed by the Analytics toolbar's range toggle. */
export interface UsageTabProps {
  /** Days of usage to ask the backend for — the toolbar's 7 / 30 / 90. */
  windowDays: number;
  navigate: Navigate;
}

/** Presentational half of the tab — rendered from an overview the caller has. */
export interface UsageTabBodyProps {
  data: UsageOverview;
  navigate: Navigate;
}
