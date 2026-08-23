import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { DataTable, type DataTableSearch } from "@/components/DataTable";
import { TemplatePicker, useTemplatePicker } from "@/components/TemplatePicker";
import { commands, isTauri, type FileRow } from "@/lib/ipc";
import { buildColumns, buildPills, DEFAULT_SORT } from "./prompts.columns";
import {
  EMPTY_HINT,
  EMPTY_TITLE,
  FAILED_BODY,
  FAILED_RETRY,
  FAILED_TITLE,
  SCAN_LABEL,
  SEARCH_PLACEHOLDER,
  TABLE_LABEL,
  TABLE_STATE_KEY,
  TEMPLATE_LABEL,
} from "./Prompts.constants";
import type { PromptsProps } from "./Prompts.types";
import { usePromptsList } from "./usePromptsList";
import "./Prompts.css";

/**
 * Shared by every render that has no rows yet, and frozen because of it: a
 * caller that pushed into it would populate all of them. Typed mutable so it
 * can stand in for a real row set (`DataTable` takes `Row[]`); the freeze is
 * what makes that safe rather than the type.
 */
const NO_ROWS = Object.freeze([] as FileRow[]) as FileRow[];

/** A row is its file: the id is the file's absolute path, unique by construction. */
const rowId = (row: FileRow) => row.id;

/**
 * The path names the row, in the table and to a screen reader. Most of these
 * files are called `CLAUDE.md`; the default label (the first column's value)
 * would give a dozen rows the same name.
 */
const rowLabel = (row: FileRow) => row.path;

/**
 * Identity-stable, which is what `DataTable`'s memoised filtering asks of it.
 * One key, because the path contains the rest: the file name is its suffix
 * and the project folder is in the middle of it.
 */
const SEARCH: DataTableSearch<FileRow> = {
  placeholder: SEARCH_PLACEHOLDER,
  keys: ["path"],
};

/**
 * Every graded prompt file the scanner knows, flat: which are worst, which
 * carry the most open issues, which project each belongs to. A row opens that
 * file's detail page; its project chip opens the project.
 */
export function Prompts({ navigate, target, data: override }: PromptsProps) {
  const state = usePromptsList();
  const data = override ?? state.data;
  const loading = state.loading && !override;
  const rows = data ?? NO_ROWS;
  // The load finished and still produced nothing to hold: the query failed.
  // An empty table would call that "nothing scanned", which is a different —
  // and false — thing to tell someone whose files are all still there.
  const failed = !loading && data == null;

  const [showTemplates, setShowTemplates] = useState(false);
  const templatePicker = useTemplatePicker();

  // Stable so the column defs below are rebuilt only when the router is.
  const openProject = useCallback(
    (projectId: string) => navigate("project", projectId),
    [navigate],
  );
  const columns = useMemo(() => buildColumns(openProject), [openProject]);
  // Rebuilt only when a scan swaps the row set, or a new deep link arrives —
  // the chips are derived from the rows themselves.
  const pills = useMemo(() => buildPills(rows, target), [rows, target]);
  // Only once the chips actually offer the linked project. `initialPills` is
  // written through — a selection nothing matches would be pruned from the
  // view but still stored, leaving a filter behind for a project this table
  // never listed. Also covers the first render, before the rows land.
  const hasTarget =
    target != null &&
    (pills.find((group) => group.id === "project")?.options.some((o) => o.id === target) ?? false);
  // A deep link names the project it means; the remembered selection only
  // decides where an unqualified visit lands. Keyed on `hasTarget` rather than
  // on `pills`, so a rescan that changes nothing about the link does not
  // re-apply it over a filter the reader has since changed.
  const initialPills = useMemo(
    () => (target && hasTarget ? { project: [target] } : undefined),
    [target, hasTarget],
  );

  const scanNow = async () => {
    await commands.scanNow();
    void state.refetch();
  };

  return (
    <section className="screen">
      <header className="screen__toolbar" data-tauri-drag-region>
        <h1 className="screen__title">Prompts</h1>
        <span className="toolbar-spacer" />
        {isTauri && (
          <Button size="sm" onClick={() => void scanNow()}>
            <Icon name="refresh" /> {SCAN_LABEL}
          </Button>
        )}
        {isTauri && (
          <Button size="sm" onClick={() => setShowTemplates(true)}>
            <Icon name="plus" /> {TEMPLATE_LABEL}
          </Button>
        )}
      </header>

      <div className="scroll-area">
        <div className="page prompts-page">
          {failed ? (
            <UnreadablePrompts onRetry={() => void state.refetch()} />
          ) : (
            <DataTable
              ariaLabel={TABLE_LABEL}
              stateKey={TABLE_STATE_KEY}
              columns={columns}
              rows={rows}
              rowId={rowId}
              rowLabel={rowLabel}
              search={SEARCH}
              pills={pills}
              initialPills={initialPills}
              defaultSort={DEFAULT_SORT}
              onRowClick={(row) => navigate("detail", row.id)}
              loading={loading}
              empty={{ title: EMPTY_TITLE, hint: EMPTY_HINT }}
            />
          )}
        </div>
      </div>

      {showTemplates && (
        <TemplatePicker
          templates={templatePicker.templates}
          entitled={templatePicker.entitled}
          loading={templatePicker.loading}
          onApply={templatePicker.applyTemplate}
          onClose={() => setShowTemplates(false)}
          navigate={navigate}
        />
      )}
    </section>
  );
}

/** The query failed — say so rather than showing an empty table, and offer the one retry there is. */
function UnreadablePrompts({ onRetry }: { onRetry: () => void }) {
  return (
    <Card padded>
      <div className="prompts-panel">
        <h2 className="prompts-panel__title">{FAILED_TITLE}</h2>
        <p className="muted prompts-panel__body">{FAILED_BODY}</p>
        <Button onClick={onRetry}>
          <Icon name="refresh" /> {FAILED_RETRY}
        </Button>
      </div>
    </Card>
  );
}
