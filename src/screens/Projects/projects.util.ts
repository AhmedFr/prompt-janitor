import type { ProjectRow, ProjectSessions } from "@/lib/ipc";
import { trim } from "@/lib/projectPath";
import { lensCounts, type LensCounts } from "@/screens/Setup/lens.util";
import type { ProjectsColumnsCtx } from "./Projects.types";

/** Sessions started in the window, per project root (from `get_usage_overview`). */
export function sessionsByProject(rows: ProjectSessions[]): Map<string, number> {
  return new Map(rows.map((r) => [trim(r.path), r.sessions]));
}

/**
 * The harness a project's lens reads: its own, else the first one the scan
 * detected — the fallback Setup uses for a graded-only lens.
 */
export function lensHarnessFor(row: ProjectRow, fallbackHarness: string): string {
  return row.harness ?? fallbackHarness;
}

const memo = new WeakMap<ProjectsColumnsCtx, Map<string, LensCounts | null>>();

/**
 * The numbers Setup would show on opening this project's lens, or `null`
 * while the inventory or the project's usage is not loaded (or failed to load).
 * A folder gone from disk shows an empty lens, so it counts zero.
 */
export function projectCounts(row: ProjectRow, ctx: ProjectsColumnsCtx): LensCounts | null {
  let cache = memo.get(ctx);
  if (!cache) memo.set(ctx, (cache = new Map()));
  if (cache.has(row.id)) return cache.get(row.id) ?? null;
  const usage = ctx.usage?.get(trim(row.id));
  let out: LensCounts | null = null;
  if (!row.exists) out = { items: 0, neverUsed: 0, erroring: 0 };
  else if (ctx.rows && usage !== undefined && usage !== null)
    out = lensCounts(ctx.rows, row.id, lensHarnessFor(row, ctx.fallbackHarness), usage);
  cache.set(row.id, out);
  return out;
}
