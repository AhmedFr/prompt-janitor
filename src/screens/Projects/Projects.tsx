import { useMemo } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { DataTable, type DataTableSearch } from "@/components/DataTable";
import type { ProjectRow } from "@/lib/ipc";
import { buildPills, DEFAULT_SORT, PROJECT_COLUMNS } from "./projects.columns";
import {
  EMPTY_HINT,
  EMPTY_TITLE,
  FAILED_BODY,
  FAILED_RETRY,
  FAILED_TITLE,
  SEARCH_PLACEHOLDER,
  TABLE_STATE_KEY,
} from "./Projects.constants";
import type { ProjectsProps } from "./Projects.types";
import { useProjects } from "./useProjects";
import "./Projects.css";

/**
 * Shared by every render that has no rows yet, and frozen because of it: a
 * caller that pushed into it would populate all of them. Typed mutable so it
 * can stand in for a real row set (`DataTable` takes `Row[]`); the freeze is
 * what makes that safe rather than the type.
 */
const NO_ROWS = Object.freeze([] as ProjectRow[]) as ProjectRow[];

/** A row is its project: the id is the project's root path, unique by construction. */
const rowId = (row: ProjectRow) => row.id;

/**
 * Identity-stable, which is what `DataTable`'s memoised filtering asks of it.
 * The path is searched as well as the name — two checkouts of the same repo
 * are told apart by nothing else.
 */
const SEARCH: DataTableSearch<ProjectRow> = {
  placeholder: SEARCH_PLACEHOLDER,
  keys: ["name", "id"],
};

/**
 * Every project the scanner knows, as one comparable table: which are graded
 * worst, which carry the most open issues, which have configured things
 * nothing ever invokes, and which folders are gone from disk. A row opens
 * that project's page.
 */
export function Projects({ navigate, data: override }: ProjectsProps) {
  const state = useProjects();
  const data = override ?? state.data;
  const loading = state.loading && !override;
  const rows = data ?? NO_ROWS;
  // The load finished and still produced nothing to hold: the query failed.
  // An empty table would call that "no projects", which is a different — and
  // false — thing to tell someone whose projects are all still there.
  const failed = !loading && data == null;

  // Rebuilt only when a scan swaps the row set — the harness chips are
  // derived from the rows themselves.
  const pills = useMemo(() => buildPills(rows), [rows]);

  return (
    <section className="screen">
      <header className="screen__toolbar" data-tauri-drag-region>
        <h1 className="screen__title">Projects</h1>
      </header>

      <div className="scroll-area">
        <div className="page projects-page">
          {failed ? (
            <UnreadableProjects onRetry={() => void state.refetch()} />
          ) : (
            <DataTable
              ariaLabel="Projects"
              stateKey={TABLE_STATE_KEY}
              columns={PROJECT_COLUMNS}
              rows={rows}
              rowId={rowId}
              search={SEARCH}
              pills={pills}
              defaultSort={DEFAULT_SORT}
              onRowClick={(row) => navigate("project", row.id)}
              loading={loading}
              density="compact"
              empty={{ title: EMPTY_TITLE, hint: EMPTY_HINT }}
            />
          )}
        </div>
      </div>
    </section>
  );
}

/** The query failed — say so rather than showing an empty table, and offer the one retry there is. */
function UnreadableProjects({ onRetry }: { onRetry: () => void }) {
  return (
    <Card padded>
      <div className="projects-panel">
        <h2 className="projects-panel__title">{FAILED_TITLE}</h2>
        <p className="muted projects-panel__body">{FAILED_BODY}</p>
        <Button onClick={onRetry}>
          <Icon name="refresh" /> {FAILED_RETRY}
        </Button>
      </div>
    </Card>
  );
}
