import type { ColumnDef } from "@tanstack/react-table";
import type { ArtifactKind, ArtifactView } from "@/lib/ipc";
import type { GradeLetter } from "@/components/Grade";
import { ActionsCell, GradeCell, PercentCell, ScopeCell, TokensCell, UsageCell } from "@/components/DataTable";
import { openExternal } from "@/lib/open-external";
import { projectNameFor } from "./setup.util";

/** The seven tabs the Setup screen renders, in display order. `settings` artifacts have no tab of their own. */
export const KIND_TABS: { id: ArtifactKind; label: string }[] = [
  { id: "rule", label: "Rules" },
  { id: "skill", label: "Skills" },
  { id: "agent", label: "Agents" },
  { id: "command", label: "Commands" },
  { id: "hook", label: "Hooks" },
  { id: "mcp_server", label: "MCP" },
  { id: "plugin", label: "Plugins" },
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

function nameColumn(): ColumnDef<ArtifactView, unknown> {
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

function scopeColumn(ctx: ColumnsCtx): ColumnDef<ArtifactView, unknown> {
  return {
    id: "scope",
    header: "Scope",
    accessorFn: (r) => (r.layer === "project" ? (projectNameFor(r.path, ctx.projectNames) ?? "Project") : r.layer),
    cell: (c) => (
      <ScopeCell layer={c.row.original.layer} projectName={projectNameFor(c.row.original.path, ctx.projectNames)} />
    ),
  };
}

function gradeColumn(): ColumnDef<ArtifactView, unknown> {
  return {
    id: "grade",
    header: "Grade",
    accessorKey: "grade",
    // The DB only ever writes A-F; the IPC type is a looser `string | null`.
    cell: (c) => <GradeCell grade={c.getValue() as GradeLetter | null} />,
  };
}

function usesColumn(): ColumnDef<ArtifactView, unknown> {
  return {
    id: "uses",
    header: "Uses",
    // Never-used sorts to the bottom of a "Uses desc" default sort.
    accessorFn: (r) => r.usage?.total ?? -1,
    cell: (c) => <UsageCell usage={c.row.original.usage} />,
  };
}

function errorRateColumn(): ColumnDef<ArtifactView, unknown> {
  return {
    id: "errorRate",
    header: "Error %",
    accessorFn: (r) => r.usage?.error_rate ?? -1,
    meta: { align: "right" },
    cell: (c) => <PercentCell value={c.row.original.usage?.error_rate} />,
  };
}

function avgTokensColumn(): ColumnDef<ArtifactView, unknown> {
  return {
    id: "avgTokens",
    header: "Avg tokens",
    accessorFn: (r) => r.usage?.avg_turn_tokens ?? -1,
    meta: { align: "right" },
    cell: (c) => <TokensCell value={c.row.original.usage?.avg_turn_tokens} />,
  };
}

function sizeColumn(): ColumnDef<ArtifactView, unknown> {
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
  return {
    id: "uses",
    header: "Bundled",
    accessorFn: (r) => ctx.pluginBundleCounts?.get(r.plugin_name ?? r.name) ?? 0,
    meta: { align: "right" },
    cell: (c) => <span className="dt-num">{c.getValue() as number}</span>,
  };
}

type ActionsKind = "rule" | "file" | "folder";

function actionsColumn(kind: ActionsKind, ctx: ColumnsCtx): ColumnDef<ArtifactView, unknown> {
  return {
    id: "actions",
    header: "Actions",
    enableSorting: false,
    meta: { align: "right" },
    cell: (c) => {
      const row = c.row.original;
      if (kind === "rule") {
        if (!row.file_id) return null;
        const fileId = row.file_id;
        return (
          <ActionsCell actions={[{ label: "Open", icon: "chevronRight", onClick: () => ctx.onOpen(fileId) }]} />
        );
      }
      const label = kind === "file" ? "Open file" : "Open folder";
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
    default:
      // `settings` has no tab of its own (not in KIND_TABS) — a conservative
      // fallback rather than an exhaustive-switch error, in case it's ever
      // rendered ad hoc (e.g. from Prompts' flat table).
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

/** Rules read best sorted by grade (worst first); everything else, by how much it's used. */
export function defaultSortFor(kind: ArtifactKind): { id: string; desc: boolean } {
  return kind === "rule" ? { id: "grade", desc: false } : { id: "uses", desc: true };
}
