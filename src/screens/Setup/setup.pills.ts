import type { ArtifactKind, ArtifactView } from "@/lib/ipc";
import type { PillGroup } from "@/components/DataTable";
import { ERROR_RATE_THRESHOLD } from "./Setup.constants";
import { filterCounts, matchProject } from "./setup.util";

/** Kinds whose Setup tab shows a Uses/Error %/Avg tokens column — the only ones "Never used", "Errors" and "High cost" mean anything for. */
const USAGE_KINDS: ReadonlySet<ArtifactKind> = new Set(["skill", "agent", "command", "mcp_server"]);

/** Kinds the harness scans out of an installed plugin's `skills/`, `agents/` and `commands/` subtrees. */
const BUNDLABLE_KINDS: ReadonlySet<ArtifactKind> = new Set(["skill", "agent", "command"]);

/** Kinds with a Scope column per spec §4.1 — everything but the plugin manifest row itself. */
const SCOPED_KINDS: ReadonlySet<ArtifactKind> = new Set([
  "rule",
  "skill",
  "agent",
  "command",
  "hook",
  "mcp_server",
]);

/**
 * "Global" plus one option per project that actually has a row in `rows` —
 * a project with nothing in this kind's slice would be an option that could
 * never highlight anything, which is worse than not offering it. `null`
 * for kinds with no Scope column (currently only `plugin`).
 */
function scopeGroup(
  kind: ArtifactKind,
  rows: ArtifactView[],
  projectNames: Map<string, string>,
): PillGroup<ArtifactView> | null {
  if (!SCOPED_KINDS.has(kind)) return null;

  const present = new Map<string, string>(); // project root path -> display name
  for (const row of rows) {
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

  return {
    id: "scope",
    label: "Scope",
    multi: true,
    options: [
      { id: "global", label: "Global", predicate: (r: ArtifactView) => r.layer === "global" },
      ...projectOptions,
    ],
  };
}

/**
 * "Never used" / "Errors" / "High cost" as one togglable group. Counts are
 * precomputed via `setup.util`'s `filterCounts` (the same slice math the old
 * Setup filter chips used) rather than left for `DataTable`'s own faceted
 * pass: these three read as a snapshot of the whole kind's slice, not as
 * counts faceted against the *other* pill groups, so there's nothing for
 * `facetedPillCounts` to add — see its doc comment on `option.count`.
 * `null` for kinds with no Uses column.
 */
function statusGroup(
  kind: ArtifactKind,
  rows: ArtifactView[],
  costBar: number | null,
): PillGroup<ArtifactView> | null {
  if (!USAGE_KINDS.has(kind)) return null;
  const counts = filterCounts(rows, costBar);
  return {
    id: "status",
    label: "Status",
    multi: true,
    options: [
      {
        id: "never",
        label: "Never used",
        predicate: (r) => r.usage == null,
        count: counts.never,
      },
      {
        id: "errors",
        label: "Errors",
        predicate: (r) => (r.usage?.error_rate ?? 0) >= ERROR_RATE_THRESHOLD,
        count: counts.errors,
      },
      {
        id: "cost",
        label: "High cost",
        predicate: (r) =>
          costBar != null && r.usage?.avg_turn_tokens != null && r.usage.avg_turn_tokens >= costBar,
        count: counts.cost,
      },
    ],
  };
}

/**
 * Rows a plugin install bundled (`layer === "plugin"`) versus ones the user
 * or a project authored directly. `null` for kinds a plugin never bundles
 * (rule, hook, mcp_server) and for the plugin kind itself, where every row
 * is trivially `layer === "plugin"`.
 */
function bundledGroup(kind: ArtifactKind, rows: ArtifactView[]): PillGroup<ArtifactView> | null {
  if (!BUNDLABLE_KINDS.has(kind)) return null;
  return {
    id: "bundled",
    label: "Source",
    options: [
      {
        id: "plugin",
        label: "Plugin-bundled",
        predicate: (r) => r.layer === "plugin",
        count: rows.filter((r) => r.layer === "plugin").length,
      },
    ],
  };
}

function buildPills(
  kind: ArtifactKind,
  rows: ArtifactView[],
  costBar: number | null,
  projectNames: Map<string, string>,
): PillGroup<ArtifactView>[] {
  return [scopeGroup(kind, rows, projectNames), statusGroup(kind, rows, costBar), bundledGroup(kind, rows)].filter(
    (group): group is PillGroup<ArtifactView> => group != null,
  );
}

/**
 * Identity-stable across calls with the same `rows` array and the same
 * `projectNames` map — cached in a nested
 * `WeakMap<rows, WeakMap<projectNames, Map<"<kind>:<costBar>", defs>>>`.
 * `DataTable`'s own memoised filtering and faceted counting key on `pills`'
 * reference (see `DataTableProps`'s doc comment), so a screen that rebuilt
 * this array inline on every render would rebuild all of that on every
 * keystroke. `kind` and `costBar` are primitives, so they fold into the
 * innermost `Map`'s string key instead of needing their own `WeakMap` layer.
 * A fresh `rows` array or `projectNames` map (e.g. after a rescan) is a
 * fresh outer key; the stale entries fall out of both `WeakMap`s once
 * nothing else references the old array/map.
 *
 * `rows` and `projectNames` are treated as immutable once handed to
 * `pillsFor`: the cache keys on their identity, so mutating either in
 * place — instead of replacing it with a new array/map — would leave
 * `pillsFor` handing back a cached predicate set built over data that no
 * longer matches, rather than triggering a rebuild.
 */
const pillsCache = new WeakMap<
  ArtifactView[],
  WeakMap<Map<string, string>, Map<string, PillGroup<ArtifactView>[]>>
>();

export function pillsFor(
  kind: ArtifactKind,
  rows: ArtifactView[],
  costBar: number | null,
  projectNames: Map<string, string>,
): PillGroup<ArtifactView>[] {
  let byProjectNames = pillsCache.get(rows);
  if (!byProjectNames) {
    byProjectNames = new WeakMap();
    pillsCache.set(rows, byProjectNames);
  }

  let byKey = byProjectNames.get(projectNames);
  if (!byKey) {
    byKey = new Map();
    byProjectNames.set(projectNames, byKey);
  }

  const key = `${kind}:${costBar}`;
  let defs = byKey.get(key);
  if (!defs) {
    defs = buildPills(kind, rows, costBar, projectNames);
    byKey.set(key, defs);
  }
  return defs;
}
