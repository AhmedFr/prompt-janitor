import type { SetupFilter } from "@/lib/setupFilter";
import { USAGE_KINDS } from "./setup.unified";
import { applyFilter } from "./setup.util";
import type { SetupRow } from "./setupRows.util";

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
