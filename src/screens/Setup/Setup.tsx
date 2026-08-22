import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { DataTable, type DataTableSearch } from "@/components/DataTable";
import { Tabs, useTabState, type TabItem } from "@/components/Tabs";
import { isTauri, type ArtifactKind, type ArtifactView, type HarnessInfo, type SetupView } from "@/lib/ipc";
import { addFolderAndScan, rescan } from "@/lib/scan-actions";
import {
  scanPercent,
  scanStatusLine,
  useScanProgress,
  type ScanProgress,
} from "@/lib/useScanProgress";
import type { Navigate } from "@/App/App.types";
import { columnsFor, defaultSortFor, KIND_TABS } from "./setup.columns";
import { pillsFor } from "./setup.pills";
import {
  EMPTY_HINT,
  EMPTY_TITLE,
  SEARCH_PLACEHOLDER,
  TAB_STATE_KEY,
  TABLE_STATE_PREFIX,
} from "./Setup.constants";
import type { SetupProps } from "./Setup.types";
import { harnessSummary, lastScanAt, projectNameFor, relativeSession } from "./setup.util";
import { useSetup } from "./useSetup";
import { useSetupTables, type SetupTables } from "./useSetupTables";
import "./Setup.css";

/**
 * The whole Claude Code setup in one place: one table per artifact kind,
 * sortable and searchable, annotated with whether anything ever actually used
 * what is installed.
 */
export function Setup({ navigate, data: override, initialTab }: SetupProps) {
  const state = useSetup();
  const data = override ?? state.data;
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
            <Icon name="refresh" /> {busy ? "Scanning…" : "Rescan"}
          </Button>
        )}
      </header>

      <div className="scroll-area">
        <div className="page setup-page">
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
            <Inventory data={data} detected={detected} navigate={navigate} initialTab={initialTab} />
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

/**
 * The same bar onboarding shows, for the same events. A rescan that only
 * greys out a button leaves a long scan indistinguishable from a hang.
 */
function ScanBar({ progress, status }: { progress: ScanProgress | null; status: string }) {
  return (
    <Card padded>
      <div className="setup-scan">
        <div className="bar" style={{ width: "100%" }}>
          <i style={{ width: `${scanPercent(progress)}%`, transition: "width .15s" }} />
        </div>
        <div className="faint tnum setup-scan__status">{status}</div>
      </div>
    </Card>
  );
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
        <h2 className="setup-empty__title">No supported agent harness found</h2>
        <p className="muted setup-empty__body">
          Prompt Janitor reads the setup Claude Code already keeps on disk. Nothing was detected
          here, so point it at a folder and it will grade the prompt files inside.
        </p>
        <Button variant="primary" disabled={busy} onClick={onAddFolder}>
          <Icon name="folder" /> Add a folder
        </Button>
      </div>
    </Card>
  );
}

/** Every tab id, for `useTabState` to resolve a remembered (or passed-in) one against. */
const TAB_IDS = KIND_TABS.map((tab) => tab.id);

/** A row is its artifact: one database id, unique across the whole inventory. */
const rowId = (row: ArtifactView) => String(row.id);

function Inventory({
  data,
  detected,
  navigate,
  initialTab,
}: {
  data: SetupView;
  detected: HarnessInfo[];
  navigate: Navigate;
  initialTab?: ArtifactKind;
}) {
  // Stable so `columnsFor`'s per-`ctx` cache can hit; see `useSetupTables`.
  const openDetail = useCallback((fileId: string) => navigate("detail", fileId), [navigate]);
  const tables = useSetupTables(data, openDetail);
  const [active, setActive] = useTabState(TAB_STATE_KEY, initialTab ?? TAB_IDS[0], TAB_IDS);

  // Identity-stable per project set, which is all `DataTable`'s memoised
  // filtering asks of it — the scope key resolves a row's project by path,
  // the same way `ScopeCell` renders it.
  const search = useMemo<DataTableSearch<ArtifactView>>(
    () => ({
      placeholder: SEARCH_PLACEHOLDER,
      keys: [
        "name",
        "description",
        (row) =>
          row.layer === "global"
            ? "Global"
            : row.layer === "plugin"
              ? "Plugin"
              : (projectNameFor(row.path, tables.projectNames) ?? "Project"),
      ],
    }),
    [tables.projectNames],
  );

  return (
    <>
      <p className="setup-harnesses">
        {detected.map((h) => (
          <span key={h.id} className="setup-harness">
            {harnessSummary(h)}
          </span>
        ))}
        <span className="setup-harness setup-harness--scan">
          Last scan {relativeSession(lastScanAt(detected))}
        </span>
      </p>

      <Tabs items={tables.tabs} active={active} onChange={setActive} ariaLabel="Setup kinds">
        {(id) => {
          // `Tabs` only ever calls back with an id from `items`, but resolving
          // it against `KIND_TABS` keeps the kind typed without a cast.
          const tab = KIND_TABS.find((candidate) => candidate.id === id) ?? KIND_TABS[0];
          return <KindTable tab={tab} tables={tables} search={search} />;
        }}
      </Tabs>
    </>
  );
}

/**
 * One kind's table. Rendered by the tab panel, so a tab switch changes this
 * component's props rather than remounting it — which is exactly what
 * `DataTable`'s `stateKey` handling expects: each kind keeps its own search,
 * pills and sort under `pj.table.setup.<kind>`.
 */
function KindTable({
  tab,
  tables,
  search,
}: {
  tab: TabItem & { id: ArtifactKind };
  tables: SetupTables;
  search: DataTableSearch<ArtifactView>;
}) {
  const { rowsFor, ctx, projectNames, costBar } = tables;
  const rows = rowsFor(tab.id);
  // Only rules have a graded file behind them to open.
  const onRowClick =
    tab.id === "rule"
      ? (row: ArtifactView) => {
          if (row.file_id) ctx.onOpen(row.file_id);
        }
      : undefined;

  return (
    <DataTable
      ariaLabel={tab.label}
      stateKey={TABLE_STATE_PREFIX + tab.id}
      columns={columnsFor(tab.id, ctx)}
      rows={rows}
      rowId={rowId}
      search={search}
      pills={pillsFor(tab.id, rows, costBar, projectNames)}
      defaultSort={defaultSortFor(tab.id)}
      onRowClick={onRowClick}
      density="compact"
      virtualize
      empty={{ title: EMPTY_TITLE[tab.id], hint: EMPTY_HINT }}
    />
  );
}
