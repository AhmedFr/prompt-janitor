import type { ArtifactKind, ArtifactView } from "@/lib/ipc";
import type { SetupRow } from "@/lib/setupRows";

/**
 * Setup's status filters (spec §4.2) and the rules behind them — shared by the
 * Setup screen, SummaryLine and the first-run reveal line, so every count of
 * "never used", "erroring" and "costly" means the same thing.
 */
export type SetupFilter = "all" | "never" | "errors" | "cost";

/** An artifact whose invocations fail this often is worth a second look. */
export const ERROR_RATE_THRESHOLD = 0.25;

/**
 * "High cost" is relative, not absolute: an artifact costs a lot when its
 * average turn burns at least twice what the typical measured artifact burns.
 */
export const COST_MEDIAN_MULTIPLIER = 2;

/** Fewest measured artifacts a median needs before "high cost" means anything. */
export const MIN_COST_SAMPLES = 2;

/** Kinds the usage index counts (skills, agents, commands, MCP servers) — hooks are not among them. */
export const USAGE_KINDS: ReadonlySet<ArtifactKind> = new Set(["skill", "agent", "command", "mcp_server"]);

/** Middle value of a sorted-ascending copy; the mean of the middle pair when even. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * What an artifact has to burn per turn to count as expensive: twice what the
 * typical measured artifact burns. `null` when fewer than
 * {@link MIN_COST_SAMPLES} artifacts have been measured — there is no typical
 * cost yet, and inventing one would flag arbitrary rows.
 *
 * Compute this once over the whole setup. Per-section medians would re-normalise
 * every list to itself, so a section holding only expensive things would report
 * half of them as cheap.
 */
export function costThreshold(artifacts: ArtifactView[]): number | null {
  const costs = artifacts
    .map((a) => a.usage?.avg_turn_tokens)
    .filter((t): t is number => t != null);
  if (costs.length < MIN_COST_SAMPLES) return null;
  return median(costs) * COST_MEDIAN_MULTIPLIER;
}

/**
 * Narrows the inventory to the slice the user asked for. Pass `threshold` — the
 * {@link costThreshold} of the whole setup — so `cost` means the same thing in
 * every section; omit it and the bar is computed from `artifacts` alone.
 */
export function applyFilter(
  artifacts: ArtifactView[],
  filter: SetupFilter,
  threshold?: number | null,
): ArtifactView[] {
  if (filter === "all") return artifacts;
  if (filter === "never") return artifacts.filter((a) => a.usage == null);
  if (filter === "errors") {
    return artifacts.filter((a) => (a.usage?.error_rate ?? 0) >= ERROR_RATE_THRESHOLD);
  }

  const bar = threshold === undefined ? costThreshold(artifacts) : threshold;
  if (bar == null) return [];
  return artifacts.filter((a) => {
    const cost = a.usage?.avg_turn_tokens;
    return cost != null && cost >= bar;
  });
}

/**
 * Setup's status filters over a slice that mixes kinds (spec §4.2). They keep
 * the definitions Setup's Status filter used, with one guard the per-kind
 * tables never needed: only a kind the usage index counts can be "never
 * used" — an instruction file or a hook has no uses to record.
 */
export function applySetupFilter(rows: SetupRow[], filter: SetupFilter, costBar: number | null): SetupRow[] {
  if (filter === "all") return rows;
  const pool = filter === "never" ? rows.filter((r) => USAGE_KINDS.has(r.kind)) : rows;
  // applyFilter only ever returns elements of its input, so these are SetupRows.
  return applyFilter(pool, filter, costBar) as SetupRow[];
}

/** The summary line's counts, one per status filter. */
export function setupFilterCounts(
  rows: SetupRow[],
  costBar: number | null,
): Record<Exclude<SetupFilter, "all">, number> {
  return {
    never: applySetupFilter(rows, "never", costBar).length,
    errors: applySetupFilter(rows, "errors", costBar).length,
    cost: applySetupFilter(rows, "cost", costBar).length,
  };
}
