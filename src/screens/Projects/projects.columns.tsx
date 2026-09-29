import type { ColumnDef, SortingFn } from "@tanstack/react-table";
import { GRADE_LETTERS, type GradeLetter } from "@/components/Grade";
import { GradeCell, type PillGroup } from "@/components/DataTable";
import { ProjectGlyph } from "@/components/ProjectGlyph";
import type { ProjectRow } from "@/lib/ipc";
// Deep import rather than the Setup barrel: this is one pure formatter, and
// the barrel would pull the whole Setup screen in behind it.
import { relativeSession } from "@/screens/Setup/setup.util";
import { GLYPH_SIZE } from "./Projects.constants";
import { trim } from "@/lib/projectPath";
import { projectCounts } from "./projects.util";
import type { ProjectsColumnsCtx } from "./Projects.types";

export type { ProjectsColumnsCtx };

/**
 * The grade a project sorts under. `ProjectRow.grade` is non-null today (the
 * read model defaults a project with no graded file to "F"), but "Z" sorts
 * after every real letter, so an ungraded row would trail rather than scatter
 * — the same sentinel the Setup tables use, for the same reason.
 */
export const gradeKey = (row: ProjectRow): string => (row.grade as GradeLetter | null) ?? "Z";

/**
 * Grade first, then the noisiest project of that grade. Both tiers invert
 * together when the header is clicked into descending — TanStack negates the
 * comparator — which reads as "worst grade first, quietest first", the exact
 * mirror of the default.
 */
const byGradeThenIssues: SortingFn<ProjectRow> = (a, b) => {
  const left = gradeKey(a.original);
  const right = gradeKey(b.original);
  if (left !== right) return left < right ? -1 : 1;
  return b.original.issue_count - a.original.issue_count;
};

/** Shown where a count is not known (not loaded yet, or its query failed) — never a false 0. */
const UNKNOWN = "—";

/** A right-aligned count cell — every rollup number in this table renders the same way. */
function countColumn(id: string, header: string, value: (r: ProjectRow) => number | null): ColumnDef<ProjectRow, unknown> {
  return {
    id,
    header,
    // Unknown sorts below every real count.
    accessorFn: (r) => value(r) ?? -1,
    meta: { align: "right" },
    cell: (c) => <span className="dt-num">{value(c.row.original) ?? UNKNOWN}</span>,
  };
}

const NAME_COLUMN: ColumnDef<ProjectRow, unknown> = {
  id: "name",
  header: "Name",
  accessorKey: "name",
  // Inline rather than a named component: this module exports column
  // *definitions*, and a capitalized helper here would trip Fast Refresh's
  // one-component-per-file check for no benefit.
  cell: (c) => (
    <span className="projects-name">
      <ProjectGlyph
        name={c.row.original.name}
        grade={c.row.original.grade}
        logo={c.row.original.logo}
        size={GLYPH_SIZE}
      />
      {c.row.original.name}
    </span>
  ),
};

const GRADE_COLUMN: ColumnDef<ProjectRow, unknown> = {
  id: "grade",
  header: "Grade",
  accessorFn: gradeKey,
  sortingFn: byGradeThenIssues,
  // Reads the raw grade, not the "Z"-substituted sort key above.
  cell: (c) => <GradeCell grade={c.row.original.grade} />,
};

const LAST_SESSION_COLUMN: ColumnDef<ProjectRow, unknown> = {
  id: "lastSession",
  header: "Last session",
  // ISO-8601 timestamps sort lexicographically; a project that never had a
  // session sorts under "" — first ascending, last descending, which is
  // where "newest first" wants it.
  accessorFn: (r) => r.last_session_at ?? "",
  cell: (c) => <span className="muted">{relativeSession(c.row.original.last_session_at)}</span>,
};

const cache = new WeakMap<ProjectsColumnsCtx, ColumnDef<ProjectRow, unknown>[]>();

/**
 * The Projects table (spec §7): exactly these columns, in this order.
 * Cached per `ctx` because `DataTable` memoises on the array's identity.
 */
export function projectColumns(ctx: ProjectsColumnsCtx): ColumnDef<ProjectRow, unknown>[] {
  const hit = cache.get(ctx);
  if (hit) return hit;
  const defs = [
    NAME_COLUMN,
    GRADE_COLUMN,
    countColumn("files", "Instructions", (r) => r.file_count),
    countColumn("items", "Items available", (r) => projectCounts(r, ctx)?.items ?? null),
    countColumn("sessions", "Sessions (90 days)", (r) => (ctx.sessions90 ? (ctx.sessions90.get(trim(r.id)) ?? 0) : null)),
    LAST_SESSION_COLUMN,
    countColumn("neverUsed", "Never used", (r) => projectCounts(r, ctx)?.neverUsed ?? null),
    countColumn("errors", "Erroring", (r) => projectCounts(r, ctx)?.erroring ?? null),
  ];
  cache.set(ctx, defs);
  return defs;
}

/** Newest activity first: the project worked in most recently leads. */
export const DEFAULT_SORT = { id: "lastSession", desc: true } as const;

/** A harness id (`claude_code`) as the product spells it (`Claude Code`). */
export function harnessLabel(id: string): string {
  return id
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Grade, status and harness chips. Grade and status are fixed — a chip that
 * matches nothing still tells the reader that slice exists, and `DataTable`
 * facets the counts. Harness is derived: the app supports one harness today,
 * and a group with a single chip that every row matches is noise, so it only
 * appears once some project actually names one.
 */
export function buildPills(rows: ProjectRow[]): PillGroup<ProjectRow>[] {
  const groups: PillGroup<ProjectRow>[] = [
    {
      id: "grade",
      label: "Grade",
      multi: true,
      options: GRADE_LETTERS.map((letter) => ({
        id: letter,
        label: letter,
        predicate: (r: ProjectRow) => r.grade === letter,
      })),
    },
    {
      id: "status",
      label: "Status",
      multi: true,
      options: [
        { id: "issues", label: "Has issues", predicate: (r: ProjectRow) => r.issue_count > 0 },
        { id: "missing", label: "Missing folder", predicate: (r: ProjectRow) => !r.exists },
      ],
    },
  ];

  const harnesses = [...new Set(rows.map((r) => r.harness).filter((h): h is string => h != null))].sort();
  if (harnesses.length > 0) {
    groups.push({
      id: "harness",
      label: "Harness",
      multi: true,
      options: harnesses.map((harness) => ({
        id: harness,
        label: harnessLabel(harness),
        predicate: (r: ProjectRow) => r.harness === harness,
      })),
    });
  }

  return groups;
}
