import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
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
import { ArtifactPanel } from "./ArtifactPanel";
import { SkillPanel } from "./SkillPanel";
import { scopeLabel, type ColumnsCtx } from "./setup.columns";
import { scopePillsFor } from "./setup.pills";
import { unifiedColumns, visibleColumnIds } from "./setup.unified";
import { costThreshold, harnessSummary, lastScanAt, projectNameMap, relativeSession } from "./setup.util";
import { applySetupFilter, setupFilterCounts } from "./setupFilter.util";
import { byKindThenName, setupRows, type SetupRow } from "./setupRows.util";
import {
  EMPTY_FILTERED,
  EMPTY_HINT,
  NEW_FROM_TEMPLATE,
  NO_HARNESS_TITLE,
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
export function Setup({ navigate, data: override, files: filesOverride, target }: SetupProps) {
  const state = useSetup();
  const data = override ?? state.data;
  const files = filesOverride ?? (override ? [] : state.files);
  const loading = state.loading && !override;
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
          {loading ? (
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
function Inventory({ data, files, detected, navigate, target, onRefetch }: InventoryProps) {
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

  // Stable so `unifiedColumns`' per-`ctx` cache can hit.
  const openDetail = useCallback((fileId: string) => navigate("detail", fileId), [navigate]);
  const ctx = useMemo<ColumnsCtx>(() => ({ onOpen: openDetail, projectNames }), [openDetail, projectNames]);

  const kindCounts = useMemo(() => {
    const out: Partial<Record<KindFilter, number>> = { all: rows.length };
    for (const r of rows) out[r.kind] = (out[r.kind] ?? 0) + 1;
    return out;
  }, [rows]);
  const ofKind = useMemo(() => (kind === "all" ? rows : rows.filter((r) => r.kind === kind)), [rows, kind]);
  const counts = useMemo(() => setupFilterCounts(ofKind, costBar), [ofKind, costBar]);
  const visible = useMemo(() => applySetupFilter(ofKind, filter, costBar), [ofKind, filter, costBar]);
  const columns = unifiedColumns(visibleColumnIds(kind, visible.length > 0 ? visible : ofKind, false), ctx);
  const pills = useMemo(() => scopePillsFor(ofKind, projectNames), [ofKind, projectNames]);
  // `scopeLabel` is the Scope column's own label rule (a graded-only row's
  // project label included), so searching a project or plugin name finds
  // exactly the rows whose Scope cell reads that way.
  const search = useMemo<DataTableSearch<SetupRow>>(
    () => ({
      placeholder: SEARCH_PLACEHOLDER,
      keys: ["name", "description", "plugin_name", (row) => scopeLabel(row, projectNames)],
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

  const onRowClick = (row: SetupRow) => {
    // Until the viewer gains its Findings tab (Task 3.9), a graded instruction still opens Detail.
    if (row.kind === "rule" && row.file_id) openDetail(row.file_id);
    else setOpenId(row.id);
  };

  return (
    <>
      <p className="setup-harnesses">
        {detected.map((h) => (
          <span key={h.id} className="setup-harness">
            {harnessSummary(h)}
          </span>
        ))}
        <span className="setup-harness setup-harness--scan">Last scan {relativeSession(lastScanAt(detected))}</span>
      </p>
      <SummaryLine grade={grade} items={ofKind.length} counts={counts} active={filter} onFilter={setFilter} />
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
        density="compact"
        virtualize
        empty={{ title: EMPTY_FILTERED, hint: EMPTY_HINT }}
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
      {/* The sheets as they are before the viewer (Task 3.9 replaces both): a
          skill opens SkillPanel, every other row ArtifactPanel; a graded
          instruction never gets here (onRowClick sends it to Detail). Keyed
          on the row so switching rows remounts them rather than leaving the
          previous row's draft or read behind. */}
      {open?.kind === "skill" ? (
        <SkillPanel
          key={open.id}
          skill={open}
          scope={scopeLabel(open, projectNames)}
          onClose={() => setOpenId(null)}
          // The save already updated `artifacts.bytes`; refetching carries
          // that into the table without waiting for a rescan.
          onSaved={() => void onRefetch()}
        />
      ) : open ? (
        <ArtifactPanel
          key={open.id}
          artifact={open}
          scope={scopeLabel(open, projectNames)}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </>
  );
}
