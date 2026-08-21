import type { ArtifactView, HarnessInfo, ProjectSetup } from "@/lib/ipc";
import type { KindGroup } from "./Setup.types";
import {
  COST_MEDIAN_MULTIPLIER,
  ERROR_RATE_THRESHOLD,
  KIND_ORDER,
  MIN_COST_SAMPLES,
} from "./Setup.constants";

/** Which slice of the inventory the screen is showing. */
export type SetupFilter = "all" | "never" | "errors" | "cost";

/**
 * Buckets artifacts by kind in {@link KIND_ORDER}, dropping kinds nothing
 * landed in so the screen never renders an empty section header.
 */
export function groupByKind(artifacts: ArtifactView[]): KindGroup[] {
  return KIND_ORDER.map((kind) => ({
    kind,
    items: artifacts.filter((a) => a.kind === kind),
  })).filter((group) => group.items.length > 0);
}

/** Middle value of a sorted-ascending copy; the mean of the middle pair when even. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Narrows the inventory to the slice the user asked for. `cost` is relative to
 * the artifacts in `artifacts` themselves — with fewer than
 * {@link MIN_COST_SAMPLES} measured artifacts there is no meaningful typical
 * cost, so nothing matches rather than everything.
 */
export function applyFilter(artifacts: ArtifactView[], filter: SetupFilter): ArtifactView[] {
  if (filter === "all") return artifacts;
  if (filter === "never") return artifacts.filter((a) => a.usage == null);
  if (filter === "errors") {
    return artifacts.filter((a) => (a.usage?.error_rate ?? 0) >= ERROR_RATE_THRESHOLD);
  }

  const costs = artifacts
    .map((a) => a.usage?.avg_turn_tokens)
    .filter((t): t is number => t != null);
  if (costs.length < MIN_COST_SAMPLES) return [];
  const threshold = median(costs) * COST_MEDIAN_MULTIPLIER;
  return artifacts.filter((a) => {
    const cost = a.usage?.avg_turn_tokens;
    return cost != null && cost >= threshold;
  });
}

/**
 * Orders projects the way the user thinks about them: the ones still on disk
 * first, most recently worked in first within that, and projects that never had
 * a session last.
 */
export function sortProjects(projects: ProjectSetup[]): ProjectSetup[] {
  return [...projects].sort((a, b) => {
    if (a.exists !== b.exists) return a.exists ? -1 : 1;
    if (a.last_session_at === b.last_session_at) return 0;
    if (a.last_session_at == null) return 1;
    if (b.last_session_at == null) return -1;
    // ISO-8601 timestamps sort lexicographically; newest first.
    return a.last_session_at < b.last_session_at ? 1 : -1;
  });
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const MONTH_DAYS = 30;

/**
 * Coarse relative age of an ISO-8601 timestamp — the harness records sessions
 * in ISO, unlike the epoch-seconds mtimes `relativeTime` formats.
 */
export function relativeSession(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "never";
  const ms = now.getTime() - then;
  if (ms < HOUR_MS) return "just now";
  if (ms < DAY_MS) return `${Math.floor(ms / HOUR_MS)}h ago`;
  const days = Math.floor(ms / DAY_MS);
  if (days < MONTH_DAYS) return `${days}d ago`;
  return `${Math.floor(days / MONTH_DAYS)}mo ago`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The one-line summary chip for a detected harness. */
export function harnessSummary(harness: HarnessInfo): string {
  return [
    harness.display_name,
    plural(harness.project_count, "project"),
    plural(harness.session_count, "session"),
  ].join(" · ");
}

/** "12 sessions" / "1 session" — the session count as it reads in a project row. */
export function sessionLabel(count: number): string {
  return plural(count, "session");
}
