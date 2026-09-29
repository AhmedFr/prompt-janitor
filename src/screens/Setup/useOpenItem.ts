import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ItemRef, ViewerTab } from "@/App/setupTarget";
import { stepTarget } from "./ItemViewer";
import type { SetupRow } from "@/lib/setupRows";
import type { SetupTargetControl } from "./Setup.types";

/** A row is its artifact (or its graded file's synthetic id): unique across the whole table. */
export const rowId = (row: SetupRow) => String(row.id);

/** The row an item reference names: by artifact id, or by file id (graded rows and the panel's fixes). */
const findRow = (rows: SetupRow[], ref: ItemRef) =>
  ("artifactId" in ref ? rows.find((r) => r.id === ref.artifactId) : rows.find((r) => r.file_id === ref.fileId)) ??
  null;

/**
 * Which row the viewer shows, on which tab — read from Setup's target, so a
 * target without `open` is no viewer and Back reopens what was open. The row
 * is re-derived from `rows`, so a rename or a rescan shows through.
 *
 * Opening is a push and a tab change a replace; stepping replaces too, so
 * one viewer is one history entry however far it walks and closing it is a
 * single step back to the table.
 */
export function useOpenItem(
  rows: SetupRow[],
  { value, change }: SetupTargetControl,
  loading: boolean,
  onCloseItem?: () => void,
) {
  const ref = value.open;
  const open = useMemo(() => (ref ? findRow(rows, ref) : null), [ref, rows]);
  const tab: ViewerTab = value.tab ?? "content";
  // A link to an item not in the rows waits while a load is in flight. Once
  // it is done, a still-missing item — or a row a rescan or the lens removed —
  // is dropped from the target, so it does not pop open on a later refresh.
  useEffect(() => {
    if (ref && !open && !loading) change({ ...value, open: undefined, tab: undefined }, "replace");
  }, [ref, open, loading, value, change]);
  // The ids the table shows, in its current sort and filters: what stepping walks.
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  // The latest target, for `openFindings` to build on without changing identity.
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  });

  const setTab = (next: ViewerTab) => change({ ...value, tab: next }, "replace");
  const step = (delta: -1 | 1) => {
    if (!open) return;
    const next = stepTarget(visibleIds, rowId(open), delta);
    if (next && next !== rowId(open)) change({ ...value, open: { artifactId: Number(next) } }, "replace");
  };
  // A file link (the Actions column's Open) lands on that file's findings.
  // Identity-stable, so `unifiedColumns`' per-`ctx` cache can hit.
  const openFindings = useCallback(
    (fileId: string) => change({ ...latest.current, open: { fileId }, tab: "findings" }, "push"),
    [change],
  );
  // Every row, graded instructions included, opens in the viewer on Content.
  const openRow = (row: SetupRow) => change({ ...value, open: { artifactId: row.id }, tab: "content" }, "push");
  // Closing navigates exactly once: through the shell's history when it has one.
  const close = () => {
    if (onCloseItem) onCloseItem();
    else change({ ...value, open: undefined, tab: undefined }, "push");
  };

  // `setVisibleIds` is a state setter: identity-stable, as the table's ids-keyed effect expects.
  return { open, tab, setTab, setVisibleIds, step, openFindings, openRow, close };
}
