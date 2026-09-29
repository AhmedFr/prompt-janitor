import type { ArtifactKind, ArtifactView } from "@/lib/ipc";
import type { PillGroup } from "@/components/DataTable";
import { matchProject } from "./setup.util";
import type { SetupRow } from "./setupRows.util";

/** Kinds with a Scope column per spec §4.1 — everything but the plugin manifest row itself. */
const SCOPED_KINDS: ReadonlySet<ArtifactKind> = new Set([
  "rule",
  "skill",
  "agent",
  "command",
  "hook",
  "mcp_server",
  "settings",
]);

/** Prefix that keeps a plugin option's id from ever colliding with a project's root path. */
const PLUGIN_OPTION_PREFIX = "plugin:";

/**
 * "Global", then one option per project that actually has a row in `rows`,
 * then one per plugin that installed one — an option for a project or plugin
 * with nothing in this kind's slice could never highlight anything, which is
 * worse than not offering it. Plugins come last because they are provenance
 * for a minority of rows, where the project options answer "whose setup is
 * this?" for the bulk of them. `null` for kinds with no Scope column
 * (currently only `plugin`, where every row is trivially plugin-layer).
 */
function scopeGroup(
  kind: ArtifactKind,
  rows: ArtifactView[],
  projectNames: Map<string, string>,
): PillGroup<ArtifactView> | null {
  if (!SCOPED_KINDS.has(kind)) return null;

  const present = new Map<string, string>(); // project root path -> display name
  const plugins = new Set<string>();
  for (const row of rows) {
    if (row.layer === "plugin") {
      if (row.plugin_name) plugins.add(row.plugin_name);
      continue;
    }
    if (row.layer !== "project") continue;
    const match = matchProject(row.path, projectNames);
    if (match) present.set(match.path, match.name);
  }

  const projectOptions = [...present.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([path, name]) => ({
      id: path,
      label: name,
      predicate: (r: ArtifactView) => r.layer === "project" && matchProject(r.path, projectNames)?.path === path,
    }));

  const pluginOptions = [...plugins].sort((a, b) => a.localeCompare(b)).map((name) => ({
    id: `${PLUGIN_OPTION_PREFIX}${name}`,
    label: name,
    predicate: (r: ArtifactView) => r.layer === "plugin" && r.plugin_name === name,
  }));

  return {
    id: "scope",
    label: "Scope",
    multi: true,
    options: [
      { id: "global", label: "Global", predicate: (r: ArtifactView) => r.layer === "global" },
      ...projectOptions,
      ...pluginOptions,
    ],
  };
}

/**
 * The Scope filter over rows of every kind (Setup's single table); no group at
 * all when no row in the slice has a scope (the Plugins chip). Not cached —
 * the caller memoises it on the slice.
 */
export function scopePillsFor(rows: SetupRow[], projectNames: Map<string, string>): PillGroup<SetupRow>[] {
  const scoped = rows.filter((r) => SCOPED_KINDS.has(r.kind));
  if (scoped.length === 0) return [];
  // A graded-only row's project may be one no inventory project knows (an
  // extra scan folder), so it lends its own path and label to the lookup —
  // for the option and for the predicate that matches it.
  const names = new Map(projectNames);
  for (const r of scoped) {
    if (r.origin === "graded" && r.project_path && r.project_label && !names.has(r.project_path)) {
      names.set(r.project_path, r.project_label);
    }
  }
  // `scopeGroup` gates on one kind; over a mixed table every scoped row
  // counts, so it is called with a scoped kind and the rows decide. Its
  // predicates read only ArtifactView fields, so they accept any SetupRow.
  const group: PillGroup<SetupRow> | null = scopeGroup("skill", scoped, names);
  return group ? [group] : [];
}
