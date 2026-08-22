import type { ColumnDef, SortingFn } from "@tanstack/react-table";
import type { GradeLetter } from "@/components/Grade";
import { GradeCell, type PillGroup } from "@/components/DataTable";
import { ProjectGlyph } from "@/components/ProjectGlyph";
import type { ProjectRow } from "@/lib/ipc";
// Deep import rather than the Setup barrel: this is one pure formatter, and
// the barrel would pull the whole Setup screen in behind it.
import { relativeSession } from "@/screens/Setup/setup.util";
import { GLYPH_SIZE, GRADE_LETTERS, MISSING_FOLDER_CHIP } from "./Projects.constants";

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

/** A right-aligned count cell — every rollup number in this table renders the same way. */
function countColumn(id: string, header: string, value: (r: ProjectRow) => number): ColumnDef<ProjectRow, unknown> {
  return {
    id,
    header,
    accessorFn: value,
    meta: { align: "right" },
    cell: (c) => <span className="dt-num">{value(c.row.original)}</span>,
  };
}

/**
 * The projects table, defined once at module level: `DataTable` memoises its
 * filtering, faceting and column model on this array's identity (see
 * `DataTableProps`), and nothing here closes over screen state, so there is
 * nothing to rebuild per render.
 */
export const PROJECT_COLUMNS: ColumnDef<ProjectRow, unknown>[] = [
  {
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
  },
  {
    id: "grade",
    header: "Grade",
    accessorFn: gradeKey,
    sortingFn: byGradeThenIssues,
    // Reads the raw grade, not the "Z"-substituted sort key above.
    cell: (c) => <GradeCell grade={c.row.original.grade as GradeLetter | null} />,
  },
  countColumn("files", "Rule files", (r) => r.file_count),
  countColumn("issues", "Open issues", (r) => r.issue_count),
  countColumn("sessions", "Sessions", (r) => r.session_count),
  {
    id: "lastSession",
    header: "Last session",
    // ISO-8601 timestamps sort lexicographically; a project that never had a
    // session sorts under "" — first ascending, last descending, which is
    // where "newest first" wants it.
    accessorFn: (r) => r.last_session_at ?? "",
    cell: (c) => <span className="muted">{relativeSession(c.row.original.last_session_at)}</span>,
  },
  countColumn("neverUsed", "Never used", (r) => r.never_used_count),
  countColumn("errors", "Errors", (r) => r.error_count),
  {
    id: "status",
    header: "Status",
    // Nothing to order by: the column is blank for every project still on
    // disk, so a sort control on it would be furniture.
    enableSorting: false,
    cell: (c) =>
      c.row.original.exists ? null : (
        <span className="projects-chip projects-chip--missing">{MISSING_FOLDER_CHIP}</span>
      ),
  },
];

/**
 * Best grade first, and within a grade the project with the most open issues
 * first — the two questions the table exists to answer, in that order.
 */
export const DEFAULT_SORT = { id: "grade", desc: false } as const;

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
