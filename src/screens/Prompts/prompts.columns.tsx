import type { ColumnDef } from "@tanstack/react-table";
import { GradeCell, PathCell, type PillGroup } from "@/components/DataTable";
import { GRADE_LETTERS } from "@/components/Grade";
import { ProviderIcon } from "@/components/ProviderIcon";
import { relativeTime } from "@/lib/format";
import type { FileRow } from "@/lib/ipc";
import {
  GLYPH_SIZE,
  OTHER_PROJECT_ID,
  OTHER_PROJECT_LABEL,
  PROJECT_PILL_LIMIT,
} from "./Prompts.constants";

/** One project, as the Project pill ranks it: how many of the table's rows it owns. */
export interface ProjectFacet {
  /** The project's id — its absolute root path. */
  id: string;
  name: string;
  count: number;
}

/**
 * Every project in the row set, busiest first. Counted from the rows rather
 * than read off `ProjectRow.file_count` so the ranking always describes the
 * table it sits above. Ties break by name, so the chip order is stable
 * between scans that change nothing.
 */
export function projectFacets(rows: FileRow[]): ProjectFacet[] {
  const byId = new Map<string, ProjectFacet>();
  for (const row of rows) {
    const found = byId.get(row.project_id);
    if (found) found.count += 1;
    else byId.set(row.project_id, { id: row.project_id, name: row.project, count: 1 });
  }
  return [...byId.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * The flat files table. Built per `onOpenProject` rather than at module level
 * — the Project cell is a link out of this table, and the only thing in these
 * defs that needs the screen. Callers must memoise the result: `DataTable`
 * memoises its filtering, faceting and column model on this array's identity
 * (see `DataTableProps`).
 */
export function buildColumns(
  onOpenProject: (projectId: string) => void,
): ColumnDef<FileRow, unknown>[] {
  return [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      // The path under the name, because the name alone doesn't identify a
      // row: most of these files are called `CLAUDE.md`. Inline rather than a
      // named component — this module exports column *definitions*, and a
      // capitalized helper here would trip Fast Refresh's
      // one-component-per-file check for no benefit.
      cell: (c) => (
        <span className="prompts-name">
          <ProviderIcon kind={c.row.original.kind} size={GLYPH_SIZE} />
          <span className="prompts-name__text">
            <span className="prompts-name__file">{c.row.original.name}</span>
            <PathCell path={c.row.original.path} />
          </span>
        </span>
      ),
    },
    {
      id: "project",
      header: "Project",
      accessorKey: "project",
      // A control inside the row, so `DataTable` gives its clicks to the chip
      // and never also opens the file (see `fromRowItself`). The label names
      // the destination: "api" on its own would read as a value, not a way out.
      cell: (c) => (
        <button
          type="button"
          className="prompts-chip"
          aria-label={`Open project ${c.row.original.project}`}
          onClick={() => onOpenProject(c.row.original.project_id)}
        >
          {c.row.original.project}
        </button>
      ),
    },
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
}

/**
 * Noisiest file first. This table is read to find what needs work, so the
 * count of open issues leads — the same default the project page's Rules tab
 * uses, for the same reason.
 */
export const DEFAULT_SORT = { id: "issues", desc: true } as const;

/**
 * A chip per kind actually scanned, then every grade, then the busiest
 * projects, then the one status worth slicing on.
 *
 * Kind and Project are derived: a chip for every kind the app can classify
 * would leave most installs with chips that match nothing, and a group whose
 * single chip every row matches excludes nothing — so both only appear once
 * there are at least two of them. Grade is fixed, because a grade with no
 * files is itself worth seeing.
 *
 * `pinned` is a deep-linked project id: it gets a chip even when the ranking
 * would have left it out, so the link that named it can select it.
 */
export function buildPills(rows: FileRow[], pinned?: string): PillGroup<FileRow>[] {
  const groups: PillGroup<FileRow>[] = [];

  const kinds = [...new Set(rows.map((row) => row.kind))].sort();
  if (kinds.length > 1) {
    groups.push({
      id: "kind",
      label: "Kind",
      multi: true,
      options: kinds.map((kind) => ({
        id: kind,
        label: kind,
        predicate: (r: FileRow) => r.kind === kind,
      })),
    });
  }

  groups.push({
    id: "grade",
    label: "Grade",
    multi: true,
    options: GRADE_LETTERS.map((letter) => ({
      id: letter,
      label: letter,
      predicate: (r: FileRow) => r.grade === letter,
    })),
  });

  const projects = projectFacets(rows);
  const named = projects.slice(0, PROJECT_PILL_LIMIT);
  if (pinned && !named.some((facet) => facet.id === pinned)) {
    const facet = projects.find((candidate) => candidate.id === pinned);
    if (facet) named.push(facet);
  }
  if (named.length > 1) {
    const namedIds = new Set(named.map((facet) => facet.id));
    const options = named.map((facet) => ({
      id: facet.id,
      label: facet.name,
      predicate: (r: FileRow) => r.project_id === facet.id,
    }));
    // Only when something is actually outside the named set — an "Other" chip
    // that matches nothing is furniture.
    if (projects.length > namedIds.size) {
      options.push({
        id: OTHER_PROJECT_ID,
        label: OTHER_PROJECT_LABEL,
        predicate: (r: FileRow) => !namedIds.has(r.project_id),
      });
    }
    groups.push({ id: "project", label: "Project", multi: true, options });
  }

  groups.push({
    id: "status",
    label: "Status",
    multi: true,
    options: [{ id: "issues", label: "Has issues", predicate: (r: FileRow) => r.issue_count > 0 }],
  });

  return groups;
}
