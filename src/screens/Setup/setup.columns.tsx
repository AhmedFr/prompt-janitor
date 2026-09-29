import type { ColumnDef } from "@tanstack/react-table";
import type { ArtifactView } from "@/lib/ipc";
import {
  CountCell,
  EMPTY_MARK,
  LastUsedCell,
  lastUsedAt,
  NameCell,
  PercentCell,
} from "@/components/DataTable";
import { projectNameFor } from "./setup.util";
import { ERROR_RATE_BANDS } from "./Setup.constants";

/**
 * What the Setup columns close over: the shape the Setup screen supplies.
 */
export interface ColumnsCtx {
  /** Opens a graded file (rule rows only — the only kind with a `file_id`): Setup's viewer on Findings. */
  onOpen: (fileId: string) => void;
  /** Project root path -> display name, for resolving a project-layer row's Scope cell. */
  projectNames: Map<string, string>;
}

/**
 * What each short column asks for, in CSS pixels — wide enough for its
 * uppercase header plus a sort caret, and no wider.
 *
 * Every column here declares one and `name` declares none, which is the whole
 * mechanism (see `ColumnMeta.width`): the table goes to fixed layout, these
 * take what they asked for, and Name absorbs the rest instead of the table
 * widening past the page and scrolling sideways — the defect that clipped
 * "running-a-feature-workflow" down to "rkflow" on the owner's screen.
 */
export const COLUMN_WIDTH = {
  kind: "100px",
  scope: "104px",
  uses: "68px",
  lastUsed: "96px",
  errorRate: "82px",
  avgTokens: "100px",
} as const;

/**
 * The Name column.
 *
 * The name and nothing else: the description is the longer half of
 * "name · description", so a column of both reads as prose and defeats the
 * one thing a name column is for — scanning down it for a name (#175, #182).
 * The description is not lost, it moves: into the tooltip here, into the
 * table's search keys (see `Setup.tsx`), and into the detail sheet every row
 * opens. The project page's combined table uses this too; its Kind column is
 * what separates two same-named artifacts there.
 *
 * The one column that declares no width: it takes whatever the sized columns
 * leave.
 */
export function nameColumn(): ColumnDef<ArtifactView, unknown> {
  return {
    id: "name",
    header: "Name",
    accessorKey: "name",
    cell: (c) => (
      <NameCell
        name={c.row.original.name}
        // Hooks bake "event: cmd" into `name` and carry no description at
        // all, so this degrades to the plain name for them.
        title={titleFor(c.row.original)}
      />
    ),
  };
}

/** The name cell's hover text: the name, plus the description it no longer shows. */
export function titleFor(row: ArtifactView): string {
  return row.description ? `${row.name} — ${row.description}` : row.name;
}

/** Mirrors `ScopeCell`'s own label rule exactly, so sorting the Scope column orders by the same text it renders. */
export function scopeLabel(row: ArtifactView, projectNames: Map<string, string>): string {
  // A graded-only row (`SetupRow`, `origin: "graded"`) carries its project's
  // name directly — its path may not fall under any inventory project the
  // lookup below knows about. `row` stays typed as `ArtifactView` so this
  // helper keeps serving both row shapes; the cast reads the extra field
  // when it's there and falls through to the lookup when it isn't.
  const graded = row as ArtifactView & { project_label?: string | null };
  if (graded.project_label) return graded.project_label;
  if (row.layer === "global") return "Global";
  // The plugin's name, not the word "Plugin": two installs can ship a skill
  // of the same name, and provenance is the only thing that tells the rows
  // apart — in the cell, in a sort, and in the screen's search keys.
  if (row.layer === "plugin") return row.plugin_name ?? "Plugin";
  return projectNameFor(row.path, projectNames) ?? "Project";
}

/**
 * Whether a usage column should stay silent about this row.
 *
 * `applies` narrows which rows a usage column makes a claim about. Every Setup
 * table holds one kind, so it is only ever invocable rows there and the
 * default (always) is right. A table that mixes kinds — the project page's
 * single combined inventory — needs the guard: `LastUsedCell` renders "never"
 * for a null rollup, which reads as a finding about a rule file rather than as
 * the fact that rule files are loaded, never called. Guarded-out rows fall
 * back to the same em dash `PercentCell`/`TokensCell` already use.
 *
 * It governs the sort key as much as the cell, and has to: a stale
 * `usage_stats` row against a rule file would otherwise rank first under
 * "Uses desc" while its cell showed "—", leaving the table ordered by a
 * number it refuses to display. Guarded-out rows take the same `-1` sentinel
 * as never-used ones.
 */
function silent(row: ArtifactView, applies?: (row: ArtifactView) => boolean): boolean {
  return applies !== undefined && !applies(row);
}

/** The em dash a guarded-out row shows in place of a claim it can't make. */
const noClaim = <span className="muted">{EMPTY_MARK}</span>;

/**
 * Three plain columns rather than one pill: a single "used 9× · 4 sessions ·
 * last 3d ago" chip can only be sorted one way, and the whole reason to have
 * the numbers in a table is to rank by any of them. Right-aligned so the
 * digits line up down the column.
 */
export function usesColumn(
  applies?: (row: ArtifactView) => boolean,
): ColumnDef<ArtifactView, unknown> {
  return {
    id: "uses",
    header: "Uses",
    // Never-used sorts to the bottom of a "Uses desc" default sort — and so
    // does a guarded-out row, whatever rollup it carries: a column that
    // refuses to show a number must not rank the table by it either.
    accessorFn: (r) => (silent(r, applies) ? -1 : r.usage?.total ?? -1),
    meta: { align: "right", width: COLUMN_WIDTH.uses },
    cell: (c) =>
      silent(c.row.original, applies) ? noClaim : <CountCell value={c.row.original.usage?.total} />,
  };
}

/**
 * Sorted by the timestamp behind the label, never by the label: "3d" and "40d"
 * compare the wrong way round as text. Rows with no last-used instant — never
 * invoked, or invoked with no recorded time — take the same `-1` sentinel the
 * other usage columns use, so they trail a descending sort instead of leading
 * it.
 */
export function lastUsedColumn(
  applies?: (row: ArtifactView) => boolean,
): ColumnDef<ArtifactView, unknown> {
  return {
    id: "lastUsed",
    header: "Last used",
    accessorFn: (r) => (silent(r, applies) ? -1 : lastUsedAt(r.usage?.last_used) ?? -1),
    meta: { align: "right", width: COLUMN_WIDTH.lastUsed },
    cell: (c) =>
      silent(c.row.original, applies) ? (
        noClaim
      ) : (
        <LastUsedCell lastUsed={c.row.original.usage?.last_used} />
      ),
  };
}

export function errorRateColumn(): ColumnDef<ArtifactView, unknown> {
  return {
    id: "errorRate",
    header: "Error %",
    accessorFn: (r) => r.usage?.error_rate ?? -1,
    meta: { align: "right", width: COLUMN_WIDTH.errorRate },
    cell: (c) => <PercentCell value={c.row.original.usage?.error_rate} thresholds={ERROR_RATE_BANDS} />,
  };
}
