import type { ColumnDef } from "@tanstack/react-table";
import type { ArtifactKind, ArtifactView } from "@/lib/ipc";
import type { GradeLetter } from "@/components/Grade";
import {
  ActionsCell,
  EMPTY_MARK,
  GradeCell,
  PercentCell,
  ScopeCell,
  TokensCell,
  UsageCell,
} from "@/components/DataTable";
import { openExternal } from "@/lib/open-external";
import { projectNameFor } from "./setup.util";

/**
 * The tabs the Setup screen renders, in display order. `settings` comes last:
 * `settings.json` is where hooks, permissions and MCP wiring actually live, so
 * a scan that finds one and shows it nowhere leaves the inventory incomplete.
 */
export const KIND_TABS: { id: ArtifactKind; label: string }[] = [
  { id: "rule", label: "Rules" },
  { id: "skill", label: "Skills" },
  { id: "agent", label: "Agents" },
  { id: "command", label: "Commands" },
  { id: "hook", label: "Hooks" },
  { id: "mcp_server", label: "MCP" },
  { id: "plugin", label: "Plugins" },
  { id: "settings", label: "Settings" },
];

/**
 * What `columnsFor` closes over. `onOpen`/`projectNames` are the shape the
 * Setup screen is required to supply; `pluginBundleCounts` is optional —
 * see the module doc below for why the Plugins tab's "bundled" column
 * can't be computed from `rows` alone, and why that pushed the count into
 * `ctx` instead.
 */
export interface ColumnsCtx {
  /** Navigates to the file's Detail screen (rule rows only — the only kind with a `file_id`). */
  onOpen: (fileId: string) => void;
  /** Project root path -> display name, for resolving a project-layer row's Scope cell. */
  projectNames: Map<string, string>;
  /**
   * Plugin name -> count of skills/agents/commands that plugin's install
   * bundled (`kind !== "plugin"`, `layer === "plugin"`, matching
   * `plugin_name`). A single kind-filtered `rows` array (the Plugins tab
   * only ever sees `kind === "plugin"` rows) can't answer this on its own —
   * it takes the *other* kinds' rows, which live in the same combined
   * inventory but get filtered out before they reach this table. The Setup
   * screen computes this map once, over the full inventory, and hands it
   * down here. Missing or no entry -> the column reads 0, never throws.
   */
  pluginBundleCounts?: Map<string, number>;
}

const SIZE_UNITS = ["B", "KB", "MB"] as const;

/** Human file size from a byte count — whole bytes under 1 KB, one decimal place above it. */
export function formatSize(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < SIZE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${SIZE_UNITS[unit]}`;
}

export function nameColumn(): ColumnDef<ArtifactView, unknown> {
  return {
    id: "name",
    header: "Name",
    accessorKey: "name",
    // Description muted alongside the name — hooks bake "event: cmd" into
    // `name` already and carry no description, so this degrades to plain
    // text for them. Inline rather than a named component: this module's
    // exports are column/pill *definitions*, not components, and a stray
    // capitalized helper here trips Fast Refresh's one-component-per-file
    // check for no benefit — nothing renders this file directly.
    cell: (c) => (
      <span>
        {c.row.original.name}
        {c.row.original.description && <span className="muted"> · {c.row.original.description}</span>}
      </span>
    ),
  };
}

/** Mirrors `ScopeCell`'s own label rule exactly, so sorting the Scope column orders by the same text it renders. */
export function scopeLabel(row: ArtifactView, projectNames: Map<string, string>): string {
  if (row.layer === "global") return "Global";
  // The plugin's name, not the word "Plugin": two installs can ship a skill
  // of the same name, and provenance is the only thing that tells the rows
  // apart — in the cell, in a sort, and in the screen's search keys.
  if (row.layer === "plugin") return row.plugin_name ?? "Plugin";
  return projectNameFor(row.path, projectNames) ?? "Project";
}

function scopeColumn(ctx: ColumnsCtx): ColumnDef<ArtifactView, unknown> {
  return {
    id: "scope",
    header: "Scope",
    // Returns the rendered label itself (not the raw `layer` value) so a
    // header-sort click orders rows exactly the way `ScopeCell` displays
    // them — "Global" before "Plugin" before a project name, not "global"
    // before "plugin" before "project".
    accessorFn: (r) => scopeLabel(r, ctx.projectNames),
    cell: (c) => (
      <ScopeCell
        layer={c.row.original.layer}
        projectName={projectNameFor(c.row.original.path, ctx.projectNames)}
        pluginName={c.row.original.plugin_name}
      />
    ),
  };
}

function gradeColumn(): ColumnDef<ArtifactView, unknown> {
  return {
    id: "grade",
    header: "Grade",
    // TanStack's default sort comparator isn't transitive over null/
    // undefined mixed with strings, so ungraded rows scatter mid-table
    // instead of grouping at the end. "Z" sorts after every real grade
    // letter (A-F), so ascending order (`defaultSortFor("rule")`) reads
    // best-grade-first with ungraded rows trailing, deterministically.
    accessorFn: (r) => r.grade ?? "Z",
    // The DB only ever writes A-F; the IPC type is a looser `string | null`.
    // Reads the raw value, not the "Z"-substituted sort key above.
    cell: (c) => <GradeCell grade={c.row.original.grade as GradeLetter | null} />,
  };
}

/**
 * `applies` narrows which rows the column makes a claim about. Every Setup
 * table holds one kind, so it is only ever invocable rows there and the
 * default (always) is right. A table that mixes kinds — the project page's
 * single combined inventory — needs the guard: `UsageCell` renders "never
 * used" for a null rollup, which reads as a finding about a rule file rather
 * than as the fact that rule files are loaded, never called. Guarded-out rows
 * fall back to the same em dash `PercentCell`/`TokensCell` already use, and
 * still sort under the never-used sentinel.
 */
export function usesColumn(
  applies?: (row: ArtifactView) => boolean,
): ColumnDef<ArtifactView, unknown> {
  return {
    id: "uses",
    header: "Uses",
    // Never-used sorts to the bottom of a "Uses desc" default sort.
    accessorFn: (r) => r.usage?.total ?? -1,
    cell: (c) =>
      applies && !applies(c.row.original) ? (
        <span className="muted">{EMPTY_MARK}</span>
      ) : (
        <UsageCell usage={c.row.original.usage} />
      ),
  };
}

export function errorRateColumn(): ColumnDef<ArtifactView, unknown> {
  return {
    id: "errorRate",
    header: "Error %",
    accessorFn: (r) => r.usage?.error_rate ?? -1,
    meta: { align: "right" },
    cell: (c) => <PercentCell value={c.row.original.usage?.error_rate} />,
  };
}

export function avgTokensColumn(): ColumnDef<ArtifactView, unknown> {
  return {
    id: "avgTokens",
    header: "Avg tokens",
    accessorFn: (r) => r.usage?.avg_turn_tokens ?? -1,
    meta: { align: "right" },
    cell: (c) => <TokensCell value={c.row.original.usage?.avg_turn_tokens} />,
  };
}

export function sizeColumn(): ColumnDef<ArtifactView, unknown> {
  return {
    id: "size",
    header: "Size",
    accessorKey: "bytes",
    meta: { align: "right" },
    cell: (c) => <span className="dt-num">{formatSize(c.getValue() as number)}</span>,
  };
}

/** Plugins' "Uses" slot: how many skills/agents/commands that install bundled, from `ctx.pluginBundleCounts`. */
function bundledColumn(ctx: ColumnsCtx): ColumnDef<ArtifactView, unknown> {
  const countFor = (row: ArtifactView) => ctx.pluginBundleCounts?.get(row.plugin_name ?? row.name) ?? 0;
  return {
    id: "uses",
    header: "Bundled",
    // Kept for sorting — TanStack memoises this per row and re-derives it
    // only when the row (or the column defs) change.
    accessorFn: countFor,
    meta: { align: "right" },
    // Reads straight from `ctx` rather than trusting the memoised
    // `getValue()`: `ctx.pluginBundleCounts` can be swapped for a fresher
    // map (a rescan) without the column defs themselves changing identity,
    // and the cell should never render a count TanStack cached before that.
    cell: (c) => <span className="dt-num">{countFor(c.row.original)}</span>,
  };
}

/** What a row's trailing action does: open its graded file, its file on disk, or its folder. */
export type ActionsKind = "rule" | "file" | "folder";

/**
 * `kind` may be one value (a Setup table, where every row is the same kind)
 * or a per-row resolver (the project page's combined table, where a rule
 * opens its Detail page and a plugin opens its folder).
 */
export function actionsColumn(
  kind: ActionsKind | ((row: ArtifactView) => ActionsKind),
  ctx: ColumnsCtx,
): ColumnDef<ArtifactView, unknown> {
  return {
    id: "actions",
    header: "Actions",
    enableSorting: false,
    meta: { align: "right" },
    cell: (c) => {
      const row = c.row.original;
      const resolved = typeof kind === "function" ? kind(row) : kind;
      if (resolved === "rule") {
        if (!row.file_id) return null;
        const fileId = row.file_id;
        // Every row in a table needs its own accessible name — a column of
        // identical "Open" buttons is indistinguishable to assistive tech.
        return (
          <ActionsCell
            actions={[{ label: `Open ${row.name}`, icon: "chevronRight", onClick: () => ctx.onOpen(fileId) }]}
          />
        );
      }
      const label = resolved === "file" ? `Open ${row.name}` : `Open folder ${row.name}`;
      const path = row.path;
      return <ActionsCell actions={[{ label, icon: "folder", onClick: () => void openExternal(path) }]} />;
    },
  };
}

function buildColumns(kind: ArtifactKind, ctx: ColumnsCtx): ColumnDef<ArtifactView, unknown>[] {
  switch (kind) {
    case "rule":
      return [nameColumn(), scopeColumn(ctx), gradeColumn(), sizeColumn(), actionsColumn("rule", ctx)];
    case "skill":
    case "agent":
    case "command":
      return [
        nameColumn(),
        scopeColumn(ctx),
        usesColumn(),
        errorRateColumn(),
        avgTokensColumn(),
        sizeColumn(),
        actionsColumn("file", ctx),
      ];
    case "hook":
      return [nameColumn(), scopeColumn(ctx)];
    case "mcp_server":
      return [nameColumn(), scopeColumn(ctx), usesColumn(), errorRateColumn(), avgTokensColumn()];
    case "plugin":
      return [nameColumn(), bundledColumn(ctx), actionsColumn("folder", ctx)];
    case "settings":
      // No usage and no grade: a settings file is configuration the harness
      // reads, never something it invokes. Name, where it applies, how big
      // it is, and a way to open it is the whole honest story.
      return [nameColumn(), scopeColumn(ctx), sizeColumn(), actionsColumn("file", ctx)];
  }
}

/**
 * Identity-stable across calls with the *same* `ctx` object — cached in a
 * `WeakMap<ctx, Map<kind, defs>>` so a screen re-rendering on every
 * keystroke doesn't rebuild `DataTable`'s column model (and, downstream,
 * its filtered set and chip counts) each time; see `DataTableProps`'s doc
 * comment on why `columns` has to be identity-stable. The cache keys on
 * `ctx`'s *identity*, not its contents: the Setup screen must memoise `ctx`
 * (a stable `onOpen`/`projectNames`/`pluginBundleCounts` across renders,
 * e.g. via `useMemo`) for the cache to ever hit — a fresh object literal
 * passed in every render defeats it exactly the way an inline
 * `columns={[...]}` would.
 *
 * `ctx` (and its `projectNames`/`pluginBundleCounts` maps) is treated as
 * immutable once handed to `columnsFor`: the cache is keyed on identity, so
 * mutating a cached `ctx` in place — instead of replacing it with a new
 * object — would leave every column def reading stale closures over the
 * old values rather than triggering a rebuild.
 */
const columnsCache = new WeakMap<ColumnsCtx, Map<ArtifactKind, ColumnDef<ArtifactView, unknown>[]>>();

export function columnsFor(kind: ArtifactKind, ctx: ColumnsCtx): ColumnDef<ArtifactView, unknown>[] {
  let byKind = columnsCache.get(ctx);
  if (!byKind) {
    byKind = new Map();
    columnsCache.set(ctx, byKind);
  }

  let defs = byKind.get(kind);
  if (!defs) {
    defs = buildColumns(kind, ctx);
    byKind.set(kind, defs);
  }
  return defs;
}

/**
 * Rules read best sorted by grade ascending — `desc: false` puts A before
 * F, best grade first, with ungraded rows trailing behind the "Z" sentinel
 * `gradeColumn` sorts them under. Hooks have no Uses column to sort by (see
 * `buildColumns`), and neither do settings files; naming one TanStack would
 * silently drop leaves the table claiming a sort it does not have — so both
 * sort by name, ascending, which is a column they actually carry. Every other kind sorts by how much
 * it is used, most-used first.
 */
export function defaultSortFor(kind: ArtifactKind): { id: string; desc: boolean } {
  if (kind === "rule") return { id: "grade", desc: false };
  if (kind === "hook" || kind === "settings") return { id: "name", desc: false };
  return { id: "uses", desc: true };
}
