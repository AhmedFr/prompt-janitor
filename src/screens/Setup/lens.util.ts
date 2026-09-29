import type { EffectiveRule, ProjectUsage, UsageStat } from "@/lib/ipc";
import { KIND_ORDER } from "./Setup.constants";
import type { SetupRow } from "./setupRows.util";
import { USAGE_KINDS } from "./setup.unified";

const trim = (p: string) => p.replace(/\/+$/, "");

/** What a plugin's rows say under the lens: the inventory lists installed plugins, not enabled ones. */
export const INSTALLED_PLUGIN = "installed plugin";

/**
 * Setup "as Claude Code sees <project>" (spec §5): what applies there, instructions
 * first in the harness's load order, then every other kind; usage counted from
 * that project's sessions only. Only `harness`'s own rows (and graded-only files) are considered. The backend knows no overrides, so nothing is
 * muted — the lens only claims what `effective_rules` actually computes.
 */
export function lensRows(
  rows: SetupRow[],
  projectPath: string,
  effective: EffectiveRule[] | null,
  usage: ProjectUsage | null,
  harness: string,
): SetupRow[] {
  const here = trim(projectPath);
  // The load order is per harness: another harness's rows would sit unnumbered beside it.
  // A graded-only file belongs to no harness (`harness: ""`) and is kept by its project alone.
  const applies = rows
    .filter((r) => r.origin === "graded" || r.harness === harness)
    .filter((r) => r.layer !== "project" || (r.project_path !== null && trim(r.project_path) === here));
  const order = new Map((effective ?? []).map((e, i) => [e.path, i + 1]));
  const ranked = new Map(
    (usage?.ranked ?? []).filter((t) => t.artifact_id !== null).map((t) => [t.artifact_id as number, t]),
  );

  const scoped = applies.map((row): SetupRow => {
    // No enablement data (see the Part 4 note): say the plugin is installed, not that it is on.
    const r = row.layer === "plugin" ? { ...row, plugin_name: `${row.plugin_name ?? "Plugin"} · ${INSTALLED_PLUGIN}` } : row;
    const load_order = r.kind === "rule" ? (order.get(r.path) ?? null) : null;
    // Machine-wide counts have no place under a project-only lens.
    if (!USAGE_KINDS.has(r.kind)) return { ...r, load_order, usage: null };
    const t = ranked.get(r.id);
    const stat: UsageStat | null = t
      ? {
          total: t.uses,
          sessions: t.sessions,
          last_used: t.last_used,
          error_rate: t.error_rate,
          avg_turn_tokens: t.avg_turn_tokens,
          count_30d: 0,
          count_prev_30d: 0,
        }
      : null;
    return { ...r, load_order, usage: stat };
  });

  const kindRank = (k: SetupRow["kind"]) => KIND_ORDER.indexOf(k);
  return scoped.sort((a, b) => {
    const ar = a.kind === "rule";
    const br = b.kind === "rule";
    if (ar !== br) return ar ? -1 : 1;
    if (ar && br) {
      if (a.load_order !== null && b.load_order !== null) return a.load_order - b.load_order;
      if (a.load_order !== null) return -1;
      if (b.load_order !== null) return 1;
    }
    return kindRank(a.kind) - kindRank(b.kind) || a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}
