import type {
  EffectiveRule,
  FileRow,
  HarnessInfo,
  InvocationKind,
  Layer,
  RankedTarget,
} from "@/lib/ipc";
import type { RankedRow } from "@/components/RankedList";
// Deep imports rather than the screen barrels: these are pure formatters, and
// a barrel would pull whole screens in behind them.
import { lastScanAt, plural } from "@/screens/Setup/setup.util";
import { rankedKey } from "@/screens/Analytics/UsageTab/usageTab.util";

/**
 * This project's scanned files. `FileRow.project_id` is the owning project's
 * absolute root path — the same value as `ProjectRow.id` — so the match is an
 * equality, never a prefix: `/code/app-legacy` starts with `/code/app` and is
 * a different project.
 */
export function filesFor(files: FileRow[], path: string): FileRow[] {
  return files.filter((file) => file.project_id === path);
}

/**
 * Load order, outermost layer first: what the harness reads before it reaches
 * the project's own rules. The backend already returns the stack in order;
 * this makes the layering explicit and survives a backend that ever groups it
 * differently.
 */
const LAYER_RANK: Record<Layer, number> = { global: 0, plugin: 1, project: 2 };

/**
 * The stack ordered global → plugin → project, preserving the backend's order
 * within a layer (`Array.prototype.sort` is stable). Returns a new array: the
 * caller's is a render prop the hook memoises on.
 */
export function orderEffectiveRules(rules: EffectiveRule[]): EffectiveRule[] {
  return [...rules].sort((a, b) => LAYER_RANK[a.layer] - LAYER_RANK[b.layer]);
}

/**
 * One invocation kind's targets as `RankedList` rows. `RankedList` sorts and
 * slices for itself, so this only reshapes: uses is the bar, and the sessions
 * behind those uses is the secondary — a target called 40 times in one
 * session is a different fact from one called 40 times across 30.
 *
 * The row id is `kind:target`, not the target: usage is grouped by the pair,
 * so a skill and an agent may legitimately share a name.
 */
export function usageRows(ranked: RankedTarget[], kind: InvocationKind): RankedRow[] {
  return ranked
    .filter((row) => row.kind === kind)
    .map((row) => ({
      id: rankedKey(row),
      label: row.target,
      value: row.uses,
      secondary: plural(row.sessions, "session"),
      // Fully-qualified MCP targets outrun their column; the tooltip keeps
      // the whole name reachable.
      title: row.target,
    }));
}

/**
 * When the harness that works in this project was last scanned. Falls back to
 * the most recent scan of any harness when the project names none (or names
 * one the setup view does not list) — the same number the Setup header shows,
 * which is the only honest answer available then.
 */
export function projectLastScan(
  harnesses: HarnessInfo[],
  harness: string | null,
): string | null {
  const own = harness == null ? undefined : harnesses.find((h) => h.id === harness);
  return own ? own.last_scan_at : lastScanAt(harnesses);
}
