import { useMemo, useState } from "react";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { GradePopover } from "@/components/GradePopover";
import { Icon } from "@/components/Icon";
import { DataTable, type DataTableSearch } from "@/components/DataTable";
import { KindChips } from "@/components/KindChips";
import { ScanBar } from "@/components/ScanBar";
import { SummaryLine } from "@/components/SummaryLine";
import { TemplatePicker, useTemplatePicker } from "@/components/TemplatePicker";
import { ViewingSwitcher } from "@/components/ViewingSwitcher";
import { isTauri, type HarnessInfo } from "@/lib/ipc";
import { addFolderAndScan, rescan } from "@/lib/scan-actions";
import { scanStatusLine, useScanProgress } from "@/lib/useScanProgress";
import { LABEL } from "@/lib/vocabulary";
import { ItemViewer } from "./ItemViewer";
import { lensRows, lensTarget, lensUsageState } from "./lens.util";
import { ProjectStrip } from "./ProjectStrip";
import { scopeLabel, type ColumnsCtx } from "./setup.columns";
import { scopePillsFor } from "./setup.pills";
import { unifiedColumns, visibleColumnIds } from "./setup.unified";
import { harnessSummary, lastScanAt, projectNameMap, relativeSession } from "./setup.util";
import { byKindThenName, loadedInFor, setupRows, type SetupRow } from "./setupRows.util";
import {
  EMPTY_FILTERED,
  EMPTY_HINT,
  LENS_TABLE_STATE_KEY,
  LENS_USAGE_FAILED,
  LENS_USAGE_LOADING,
  MISSING_FOLDER_EMPTY,
  NEW_FROM_TEMPLATE,
  NO_HARNESS_TITLE,
  NO_ITEMS_TITLE,
  REVEAL_FAILED,
  SEARCH_PLACEHOLDER,
  TABLE_STATE_KEY,
} from "./Setup.constants";
import type { InventoryProps, SetupProps } from "./Setup.types";
import { useLens } from "./useLens";
import { rowId, useOpenItem } from "./useOpenItem";
import { useOverallGrade } from "./useOverallGrade";
import { useRevealProject } from "./useRevealProject";
import { useSetup } from "./useSetup";
import { useSetupLens } from "./useSetupLens";
import { useSetupSlice } from "./useSetupSlice";
import { useSetupTarget } from "./useSetupTarget";
import "./Setup.css";

/**
 * The whole Claude Code setup in one place: one table over every kind,
 * narrowed by kind chips and the summary line's filters, annotated with
 * whether anything ever actually used what is installed.
 */
export function Setup({
  navigate,
  data: override,
  files: filesOverride,
  target,
  onTargetChange,
  onCloseItem,
  loading: loadingOverride,
  lensData: lensOverride,
}: SetupProps) {
  const state = useSetup();
  const data = override ?? state.data;
  const files = filesOverride ?? (override ? [] : state.files);
  const refreshing = loadingOverride ?? (state.loading && !override);
  const [busy, setBusy] = useState(false);
  const scan = useScanProgress();
  // Setup's whole place — kind, filter, lens, open item, tab — held by the
  // shell's navigation when it is controlled, else here (stories, tests).
  const control = useSetupTarget(target, onTargetChange);
  // The lens has one owner: this screen renders the Viewing control, so the table only reads it.
  const { lens, lensProject, choices, onLens } = useSetupLens(control, data, files);
  const detected = data?.harnesses.filter((h) => h.detected) ?? [];
  // A graded-only lens reads as the harness the scan found, the same one its rows are decided with.
  const liveLens = useLens(lensTarget(lens, lensProject, detected[0]?.id ?? null));
  const lensData = lensOverride ?? liveLens;
  const reveal = useRevealProject(lensProject?.path ?? null);

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

  return (
    <section className="screen">
      <header className="screen__toolbar" data-tauri-drag-region>
        <BackButton />
        <h1 className="screen__title">Setup</h1>
        {data && <ViewingSwitcher projects={choices} lens={lens} onChange={onLens} />}
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
            <>
              {lensProject && (
                <ProjectStrip
                  project={lensProject}
                  sessionsPerDay={lensData.usage?.sessions_per_day ?? null}
                  onReveal={() => void reveal.reveal()}
                />
              )}
              {lensProject && reveal.error && (
                <p className="setup-reveal-error" role="alert">
                  {REVEAL_FAILED}: {reveal.error}
                </p>
              )}
              <Inventory
                data={data}
                files={files}
                detected={detected}
                navigate={navigate}
                control={control}
                onCloseItem={onCloseItem}
                loading={refreshing}
                onRefetch={state.refetch}
                lens={lens}
                lensProject={lensProject}
                lensData={lensData}
                onLens={onLens}
              />
            </>
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

/**
 * The one table over every kind (spec §4). The chips pick a kind, the summary
 * line a status filter, a row opens the viewer — all read from `control` and
 * reported through it; Inventory holds none of it. Rows arrive Kind
 * then Name, so every slice starts in that order.
 */
function Inventory({
  data,
  files,
  detected,
  navigate,
  control,
  onCloseItem,
  loading,
  onRefetch,
  lens,
  lensProject,
  lensData,
  onLens,
}: InventoryProps) {
  const projectNames = useMemo(() => projectNameMap(data.projects), [data]);
  const base = useMemo(() => setupRows(data, files), [data, files]);
  // A graded-only lens has no project to name a harness: it reads as the harness the scan found.
  const lensHarness = lensProject?.harness ?? detected[0]?.id ?? "";
  const rows = useMemo(() => {
    if (lens === null) return byKindThenName(base);
    // A lensed project that is gone from disk shows an empty table under the missing-folder banner.
    if (lensProject !== null && !lensProject.exists) return [];
    return lensRows(base, lens, lensData.effective, lensData.usage, lensHarness);
  }, [base, lens, lensProject, lensData.effective, lensData.usage, lensHarness]);
  // Until the lens has read the project's usage, every usage row is null — which is unknown, not unused.
  const usageState = lensUsageState(lens !== null, lensData);
  const usageKnown = usageState === "known";
  const { kind, setKind, filter, setFilter, kindCounts, ofKind, counts, visible, clearSlice } = useSetupSlice(rows, control, usageKnown);
  // No Scope under the lens (spec §5): every row already applies to the one project.
  const pills = useMemo(() => (lens === null ? scopePillsFor(ofKind, projectNames) : []), [lens, ofKind, projectNames]);
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
  const { open, tab, setTab, setVisibleIds, step, openFindings, openRow, close } = useOpenItem(rows, control, loading, onCloseItem);
  const ctx = useMemo<ColumnsCtx>(() => ({ onOpen: openFindings, projectNames }), [openFindings, projectNames]);
  const columns = unifiedColumns(visibleColumnIds(kind, visible.length > 0 ? visible : ofKind, lens !== null, usageKnown), ctx);
  const usageNote =
    usageState === "loading" ? (
      <span className="muted">{LENS_USAGE_LOADING}</span>
    ) : usageState === "failed" ? (
      <span className="setup-usage-error" role="alert">
        {LENS_USAGE_FAILED}
        <Button size="sm" onClick={() => lensData.retry?.()}>
          Retry
        </Button>
      </span>
    ) : undefined;

  // An empty table is a gone folder, a setup with nothing in it, or a slice the
  // filters emptied — then one Clear filters resets the chip and the summary
  // filter, and the table's own search and Scope with them (spec §4.5).
  const missingFolder = lensProject !== null && !lensProject.exists;
  const empty = useMemo(
    () =>
      missingFolder
        ? { title: MISSING_FOLDER_EMPTY }
        : rows.length === 0
          ? { title: NO_ITEMS_TITLE, hint: EMPTY_HINT }
          : { title: EMPTY_FILTERED, clear: { title: EMPTY_FILTERED, onClear: clearSlice } },
    [missingFolder, rows.length, clearSlice],
  );

  return (
    <>
      <p className="setup-harnesses">
        {detected.map((h) => (
          <span key={h.id} className="setup-harness">
            {harnessSummary(h)}
          </span>
        ))}
      </p>
      <SummaryLine badge={<GradePopover grade={grade} />} grade={grade} items={ofKind.length} counts={counts} active={filter} onFilter={setFilter} usageNote={usageNote} />
      <DataTable
        ariaLabel="Setup"
        // Its own key under the lens: the rows arrive in load order, with no Scope to remember.
        stateKey={lens === null ? TABLE_STATE_KEY : LENS_TABLE_STATE_KEY}
        columns={columns}
        rows={visible}
        rowId={rowId}
        search={search}
        pills={pills}
        // No defaultSort: `rows` already arrive Kind then Name (byKindThenName), or in load order under the lens.
        onRowClick={openRow}
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
          onClose={close}
          onStep={step}
          // A save or fix already updated the index; refetching carries that
          // into the table without waiting for a rescan.
          onSaved={() => void onRefetch()}
          loadedIn={loadedInFor(open, data.projects)}
          onSelectProject={onLens}
        />
      )}
    </>
  );
}
