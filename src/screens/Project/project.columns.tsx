import type { ColumnDef } from "@tanstack/react-table";
import type { ArtifactKind, ArtifactView, FileRow } from "@/lib/ipc";
import { GradeCell, type PillGroup } from "@/components/DataTable";
import { relativeTime } from "@/lib/format";
import { KIND_ORDER } from "@/screens/Setup/Setup.constants";
import {
  actionsColumn,
  avgTokensColumn,
  errorRateColumn,
  nameColumn,
  sizeColumn,
  usesColumn,
  type ActionsKind,
  type ColumnsCtx,
} from "@/screens/Setup/setup.columns";
import { KIND_PILL_LABEL } from "./Project.constants";

/**
 * The kinds an agent can actually invoke. Everything else in the inventory is
 * configuration the harness *reads* — a rule file, a settings file, a hook
 * definition — so a usage column would be answering a question nobody asked
 * of it. See `usesColumn`'s `applies` guard.
 */
const INVOCABLE_KINDS: ReadonlySet<ArtifactKind> = new Set<ArtifactKind>([
  "skill",
  "agent",
  "command",
  "mcp_server",
]);

/**
 * The project's rule files, defined once at module level: `DataTable`
 * memoises its filtering, faceting and column model on this array's identity
 * (see `DataTableProps`), and nothing here closes over screen state. Opening
 * a row is the table's `onRowClick`, not a column, so there is nothing to
 * parameterise.
 */
export const PROJECT_RULE_COLUMNS: ColumnDef<FileRow, unknown>[] = [
  { id: "name", header: "Name", accessorKey: "name" },
  {
    id: "kind",
    header: "Kind",
    accessorKey: "kind",
    cell: (c) => <span className="muted">{c.row.original.kind}</span>,
  },
  {
    id: "grade",
    header: "Grade",
    accessorKey: "grade",
    cell: (c) => <GradeCell grade={c.row.original.grade} />,
  },
  {
    id: "issues",
    header: "Issues",
    accessorKey: "issue_count",
    meta: { align: "right" },
    cell: (c) => <span className="dt-num">{c.row.original.issue_count}</span>,
  },
  {
    id: "modified",
    header: "Modified",
    // Epoch seconds as a string sort lexicographically only while they are
    // the same length; parsed to a number they sort correctly for good. A
    // file with no recorded mtime sorts oldest rather than scattering.
    accessorFn: (r) => Number(r.modified ?? 0),
    meta: { align: "right" },
    cell: (c) => <span className="muted tnum">{relativeTime(c.row.original.modified)}</span>,
  },
];

/**
 * Noisiest file first. A project page is read to find what needs work, so the
 * count of open issues leads — unlike the Setup screen's rules table, which
 * is an inventory and sorts by grade.
 */
export const RULES_DEFAULT_SORT = { id: "issues", desc: true } as const;

/** The combined setup table groups by kind, in the inventory's own order. */
export const SETUP_DEFAULT_SORT = { id: "kind", desc: false } as const;

/**
 * Where a row's kind sits in {@link KIND_ORDER}, zero-padded so the Kind
 * column sorts the table into the same groups the Setup screen splits into
 * tabs — rather than alphabetically, which would file Settings between
 * Rules and Skills.
 */
function kindRank(kind: ArtifactKind): string {
  const index = KIND_ORDER.indexOf(kind);
  // A kind outside the known order (a stale database row) sorts last rather
  // than first, which is where `-1` would put it.
  return String(index === -1 ? KIND_ORDER.length : index).padStart(2, "0");
}

/** What a row's trailing action should do, given the kind of thing it is. */
export function actionsKindFor(row: ArtifactView): ActionsKind {
  if (row.kind === "rule") return "rule";
  if (row.kind === "plugin") return "folder";
  return "file";
}

function kindColumn(): ColumnDef<ArtifactView, unknown> {
  return {
    id: "kind",
    header: "Kind",
    accessorFn: (r) => kindRank(r.kind),
    cell: (c) => (
      <span className="project-kind" data-kind={c.row.original.kind}>
        {KIND_PILL_LABEL[c.row.original.kind]}
      </span>
    ),
  };
}

/**
 * Identity-stable per `ctx`, cached in a `WeakMap` for exactly the reason
 * `columnsFor` is (see its doc comment): `DataTable` rebuilds its column
 * model, filtered set and chip counts whenever `columns` changes identity, so
 * a screen re-rendering on every keystroke must hand back the same array.
 * `ctx` is treated as immutable — replaced, never mutated in place.
 */
const cache = new WeakMap<ColumnsCtx, ColumnDef<ArtifactView, unknown>[]>();

/**
 * One table for the whole project, where the Setup screen has eight. Every
 * row here is in the same project, so `Scope` — which exists to say *where* a
 * row applies — would be the same word on every line; `Kind` says the thing
 * the reader actually can't tell from the row, and takes its place. The
 * remaining columns are the Setup screen's own builders, not copies of them,
 * so a change to how a size or an error rate reads lands in both places.
 */
export function projectSetupColumns(ctx: ColumnsCtx): ColumnDef<ArtifactView, unknown>[] {
  let defs = cache.get(ctx);
  if (!defs) {
    defs = [
      kindColumn(),
      nameColumn(),
      usesColumn((row) => INVOCABLE_KINDS.has(row.kind)),
      errorRateColumn(),
      avgTokensColumn(),
      sizeColumn(),
      actionsColumn(actionsKindFor, ctx),
    ];
    cache.set(ctx, defs);
  }
  return defs;
}

/**
 * A Kind chip per kind the project actually holds. Derived rather than fixed:
 * a chip for every `ArtifactKind` would leave most projects with a row of
 * chips that match nothing, and `DataTable` facets the counts of the ones
 * that stay.
 */
export function projectSetupPills(rows: ArtifactView[]): PillGroup<ArtifactView>[] {
  const present = KIND_ORDER.filter((kind) => rows.some((row) => row.kind === kind));
  if (present.length < 2) return [];
  return [
    {
      id: "kind",
      label: "Kind",
      multi: true,
      options: present.map((kind) => ({
        id: kind,
        label: KIND_PILL_LABEL[kind],
        predicate: (r: ArtifactView) => r.kind === kind,
      })),
    },
  ];
}
