import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { GradePopover } from "@/components/GradePopover";
import { Icon } from "@/components/Icon";
import { DataTable, type DataTableSearch } from "@/components/DataTable";
import { KindChips } from "@/components/KindChips";
import { ScanBar } from "@/components/ScanBar";
import { SummaryLine } from "@/components/SummaryLine";
import { TemplatePicker, useTemplatePicker } from "@/components/TemplatePicker";
import { isTauri, type HarnessInfo } from "@/lib/ipc";
import { addFolderAndScan, rescan } from "@/lib/scan-actions";
import type { SetupFilter } from "@/lib/setupFilter";
import { scanStatusLine, useScanProgress } from "@/lib/useScanProgress";
import { LABEL, type KindFilter } from "@/lib/vocabulary";
import { formatSetupTarget, type ItemRef, type ViewerTab } from "@/App/setupTarget";
import { ItemViewer, stepTarget } from "./ItemViewer";
import { scopeLabel, type ColumnsCtx } from "./setup.columns";
import { scopePillsFor } from "./setup.pills";
import { unifiedColumns, visibleColumnIds } from "./setup.unified";
import { costThreshold, harnessSummary, lastScanAt, projectNameMap, relativeSession } from "./setup.util";
import { applySetupFilter, setupFilterCounts } from "./setupFilter.util";
import { byKindThenName, loadedInFor, setupRows, type SetupRow } from "./setupRows.util";
import {
  EMPTY_FILTERED,
  EMPTY_HINT,
  NEW_FROM_TEMPLATE,
  NO_HARNESS_TITLE,
  NO_ITEMS_TITLE,
  SEARCH_PLACEHOLDER,
  TABLE_STATE_KEY,
} from "./Setup.constants";
import type { InventoryProps, SetupProps } from "./Setup.types";
import { useOverallGrade } from "./useOverallGrade";
import { useSetup } from "./useSetup";
import "./Setup.css";

/**
 * The whole Claude Code setup in one place: one table over every kind,
 * narrowed by kind chips and the summary line's filters, annotated with
 * whether anything ever actually used what is installed.
 */
export function Setup({ navigate, data: override, files: filesOverride, target, loading: loadingOverride }: SetupProps) {
  const state = useSetup();
  const data = override ?? state.data;
  const files = filesOverride ?? (override ? [] : state.files);
  const refreshing = loadingOverride ?? (state.loading && !override);
  const [busy, setBusy] = useState(false);
  const scan = useScanProgress();

  // A scan refreshes the inventory through the `scan-done` listener in
  // `useSetup`, so nothing here needs to refetch on its own.
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const detected = data?.harnesses.filter((h) => h.detected) ?? [];

  return (
    <section className="screen">
      <header className="screen__toolbar" data-tauri-drag-region>
        <h1 className="screen__title">Setup</h1>
        <span className="toolbar-spacer" />
        {/* The one place the main window says when the last scan ran (spec §4.1). */}
        {detected.length > 0 && (
          <span className="muted setup-scanned">scanned {relativeSession(lastScanAt(detected))}</span>
        )}
        {detected.length > 0 && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => {
              scan.reset();
              void run(rescan);
            }}
          >
            <Icon name="refresh" /> {busy ? LABEL.scanning : LABEL.scan}
          </Button>
        )}
      </header>

      <div className="scroll-area">
        <div className="page page--table setup-page">
          {busy && (
            <ScanBar
              progress={scan.progress}
              status={scanStatusLine(scan.phase, scan.progress, harnessName(detected))}
            />
          )}
          {/* Loading only while there is nothing to show: a refresh renders over the data it replaces. */}
          {refreshing && !data ? (
            <Card padded>
              <div className="muted">
                {isTauri ? "Loading…" : "Open the Prompt Janitor desktop app to see your setup."}
              </div>
            </Card>
          ) : !data ? (
            <UnreadableSetup busy={busy} onRetry={() => void run(state.refetch)} />
          ) : detected.length === 0 ? (
            <NoHarness busy={busy} onAddFolder={() => void run(addFolderAndScan)} />
          ) : (
            <Inventory
              data={data}
              files={files}
              detected={detected}
              navigate={navigate}
              target={target}
              loading={refreshing}
              onRefetch={state.refetch}
            />
          )}
        </div>
      </div>
    </section>
  );
}

/** Whose sessions the scan is indexing right now, for the phase line. */
function harnessName(detected: HarnessInfo[]): string {
  return detected[0]?.display_name ?? "agent";
}

/** The query failed — say so rather than spinning, and offer the one retry there is. */
function UnreadableSetup({ busy, onRetry }: { busy: boolean; onRetry: () => void }) {
  return (
    <Card padded>
      <div className="setup-empty">
        <h2 className="setup-empty__title">Setup could not be read</h2>
        <p className="muted setup-empty__body">
          The inventory query failed. This is usually a scan still holding the database — try again
          in a moment.
        </p>
        <Button disabled={busy} onClick={onRetry}>
          <Icon name="refresh" /> Try again
        </Button>
      </div>
    </Card>
  );
}

/** Nothing to inventory — the one thing left to do is point us at a folder. */
function NoHarness({ busy, onAddFolder }: { busy: boolean; onAddFolder: () => void }) {
  return (
    <Card padded>
      <div className="setup-empty">
        <h2 className="setup-empty__title">{NO_HARNESS_TITLE}</h2>
        <p className="muted setup-empty__body">
          Prompt Janitor reads the setup Claude Code already keeps on disk. Nothing was detected
          here, so point it at a folder and it will grade the prompt files inside.
        </p>
        <Button variant="primary" disabled={busy} onClick={onAddFolder}>
          <Icon name="folder" /> {LABEL.addFolder}
        </Button>
      </div>
    </Card>
  );
}

/** A row is its artifact (or its graded file's synthetic id): unique across the whole table. */
const rowId = (row: SetupRow) => String(row.id);

/**
 * The one table over every kind (spec §4). The chips pick a kind, the summary
 * line a status filter; both start from a deep link's `target` when there is
 * one. Rows arrive Kind then Name, so every slice starts in that order.
 */
function Inventory({ data, files, detected, navigate, target, loading, onRefetch }: InventoryProps) {
  const projectNames = useMemo(() => projectNameMap(data.projects), [data]);
  const rows = useMemo(() => byKindThenName(setupRows(data, files)), [data, files]);
  // Over the whole setup, not the slice: "costly" means the same on every chip.
  const costBar = useMemo(() => costThreshold(rows), [rows]);
  const [kind, setKind] = useState<KindFilter>(target?.kind ?? "all");
  const [filter, setFilter] = useState<SetupFilter>(target?.filter ?? "all");
  // A deep link names the slice it means, even when Setup is already mounted.
  useEffect(() => {
    if (target?.kind) setKind(target.kind);
  }, [target?.kind]);
  useEffect(() => {
    if (target?.filter) setFilter(target.filter);
  }, [target?.filter]);

  const kindCounts = useMemo(() => {
    const out: Partial<Record<KindFilter, number>> = { all: rows.length };
    for (const r of rows) out[r.kind] = (out[r.kind] ?? 0) + 1;
    return out;
  }, [rows]);
  const ofKind = useMemo(() => (kind === "all" ? rows : rows.filter((r) => r.kind === kind)), [rows, kind]);
  const counts = useMemo(() => setupFilterCounts(ofKind, costBar), [ofKind, costBar]);
  const visible = useMemo(() => applySetupFilter(ofKind, filter, costBar), [ofKind, filter, costBar]);
  const pills = useMemo(() => scopePillsFor(ofKind, projectNames), [ofKind, projectNames]);
  // `scopeLabel` is the Scope column's own label rule (a graded-only row's
  // project label included), so searching a project or plugin name finds
  // exactly the rows whose Scope cell reads that way.
  const search = useMemo<DataTableSearch<SetupRow>>(
    () => ({
      placeholder: SEARCH_PLACEHOLDER,
      keys: ["name", "description", "path", "plugin_name", (row) => scopeLabel(row, projectNames)],
    }),
    [projectNames],
  );
  const { grade } = useOverallGrade();
  const templates = useTemplatePicker();
  const [picking, setPicking] = useState(false);
  // The *id* of the open row, re-derived below so a rename or a rescan shows
  // through — and a row a rescan removed closes its sheet.
  const [openId, setOpenId] = useState<number | null>(null);
  const open = useMemo(() => (openId === null ? null : (rows.find((r) => r.id === openId) ?? null)), [openId, rows]);
  // A row a rescan removed closes its sheet for good: the id is dropped, so
  // the row coming back on a later rescan does not pop the sheet open again.
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
  const ctx = useMemo<ColumnsCtx>(() => ({ onOpen: openFindings, projectNames }), [openFindings, projectNames]);
  const columns = unifiedColumns(visibleColumnIds(kind, visible.length > 0 ? visible : ofKind, false), ctx);

  // An empty table is either a setup with nothing in it, or a slice the
  // filters emptied — then one Clear filters resets the chip and the summary
  // filter here, and the table's own search and Scope with them (spec §4.5).
  const clearSlice = useCallback(() => {
    setKind("all");
    setFilter("all");
  }, []);
  const empty = useMemo(
    () =>
      rows.length === 0
        ? { title: NO_ITEMS_TITLE, hint: EMPTY_HINT }
        : { title: EMPTY_FILTERED, clear: { title: EMPTY_FILTERED, onClear: clearSlice } },
    [rows.length, clearSlice],
  );

  // Every row, graded instructions included, opens in the viewer on Content.
  const onRowClick = (row: SetupRow) => {
    setOpenId(row.id);
    setTab("content");
  };

  return (
    <>
      <p className="setup-harnesses">
        {detected.map((h) => (
          <span key={h.id} className="setup-harness">
            {harnessSummary(h)}
          </span>
        ))}
      </p>
      <SummaryLine badge={<GradePopover grade={grade} />} grade={grade} items={ofKind.length} counts={counts} active={filter} onFilter={setFilter} />
      <DataTable
        ariaLabel="Setup"
        stateKey={TABLE_STATE_KEY}
        columns={columns}
        rows={visible}
        rowId={rowId}
        search={search}
        pills={pills}
        // No defaultSort: `rows` already arrive Kind then Name (byKindThenName), in every slice.
        onRowClick={onRowClick}
        // A state setter: identity-stable, as the table's ids-keyed effect expects.
        onVisibleRowsChange={setVisibleIds}
        density="compact"
        virtualize
        empty={empty}
        // Next to the search and Scope (spec §4.3); the toolbar wraps, so the
        // chips drop to their own line in a narrow window.
        toolbarRight={
          <>
            <KindChips counts={kindCounts} active={kind} onChange={setKind} />
            {kind === "rule" && (
              <Button size="sm" onClick={() => setPicking(true)}>
                <Icon name="plus" /> {NEW_FROM_TEMPLATE}
              </Button>
            )}
          </>
        }
      />
      {picking && (
        <TemplatePicker
          templates={templates.templates}
          entitled={templates.entitled}
          loading={templates.loading}
          onApply={templates.applyTemplate}
          onClose={() => setPicking(false)}
          navigate={navigate}
        />
      )}
      {/* Keyed on the row, so stepping or a new link remounts the viewer
          rather than leaving the previous row's mode, draft or read behind. */}
      {open && (
        <ItemViewer
          key={open.id}
          item={open}
          scope={scopeLabel(open, projectNames)}
          tab={tab}
          onTab={setTab}
          onClose={() => setOpenId(null)}
          onStep={step}
          // A save or fix already updated the index; refetching carries that
          // into the table without waiting for a rescan.
          onSaved={() => void onRefetch()}
          loadedIn={loadedInFor(open, data.projects)}
          onSelectProject={(path) => navigate("setup", formatSetupTarget({ lens: path }))}
        />
      )}
    </>
  );
}
