import { useCallback, useEffect, useMemo, useState } from "react";
import type { ItemRef, SetupTarget, ViewerTab } from "@/App/setupTarget";
import { stepTarget } from "./ItemViewer";
import type { SetupRow } from "./setupRows.util";

/** A row is its artifact (or its graded file's synthetic id): unique across the whole table. */
export const rowId = (row: SetupRow) => String(row.id);

/**
 * Which row the viewer shows, on which tab. The open row is held by id and
 * re-derived from `rows`, so a rename or a rescan shows through, and a row
 * that leaves `rows` (a rescan removed it, or the lens left it out) closes
 * its viewer.
 */
export function useOpenItem(rows: SetupRow[], target: SetupTarget | undefined, loading: boolean) {
  const [openId, setOpenId] = useState<number | null>(null);
  const open = useMemo(() => (openId === null ? null : (rows.find((r) => r.id === openId) ?? null)), [openId, rows]);
  // A removed row closes its viewer for good: the id is dropped, so the row
  // coming back on a later rescan does not pop the viewer open again.
  useEffect(() => {
    if (openId !== null && !open) setOpenId(null);
  }, [openId, open]);
  const [tab, setTab] = useState<ViewerTab>(target?.tab ?? "content");
  // The ids the table shows, in its current sort and filters: what stepping walks.
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  // A deep link names an item by artifact id, or by file id (graded rows and the panel's fixes).
  // It waits here until the rows hold its item; if the load is done and the item is
  // still missing, it is dropped rather than left to pop open on a later refresh.
  // The tab travels with it, so it is the tab of the link that asked.
  const [pending, setPending] = useState<{ ref: ItemRef; tab: ViewerTab } | null>(null);
  useEffect(() => {
    if (target?.open) setPending({ ref: target.open, tab: target.tab ?? "content" });
  }, [target?.open, target?.tab]);
  useEffect(() => {
    if (!pending) return;
    const { ref } = pending;
    const row = "artifactId" in ref ? rows.find((r) => r.id === ref.artifactId) : rows.find((r) => r.file_id === ref.fileId);
    if (row) {
      setOpenId(row.id);
      setTab(pending.tab);
      setPending(null);
    } else if (!loading) {
      setPending(null);
    }
  }, [pending, rows, loading]);

  const step = (delta: -1 | 1) => {
    if (!open) return;
    const next = stepTarget(visibleIds, rowId(open), delta);
    if (next) setOpenId(Number(next));
  };
  // A file link (the Actions column's Open) lands on that file's findings.
  // Resolved through `pending` so this stays stable — `unifiedColumns`' per-`ctx` cache can hit.
  const openFindings = useCallback((fileId: string) => setPending({ ref: { fileId }, tab: "findings" }), []);
  // Every row, graded instructions included, opens in the viewer on Content.
  const openRow = (row: SetupRow) => {
    setOpenId(row.id);
    setTab("content");
  };
  const close = () => setOpenId(null);

  // `setVisibleIds` is a state setter: identity-stable, as the table's ids-keyed effect expects.
  return { open, tab, setTab, setVisibleIds, step, openFindings, openRow, close };
}
