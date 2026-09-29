import { useMemo, useState } from "react";
import { DataTable, type DataTableSearch } from "@/components/DataTable";
import type { ArtifactView } from "@/lib/ipc";
import type { ViewerTab } from "@/App/setupTarget";
import { ItemViewer } from "@/screens/Setup/ItemViewer";
import { scopeLabel } from "@/screens/Setup/setup.columns";
import type { SetupRow } from "@/screens/Setup/setupRows.util";
import {
  SETUP_EMPTY_HINT,
  SETUP_EMPTY_TITLE,
  SETUP_SEARCH_PLACEHOLDER,
  SETUP_TABLE_KEY,
} from "../Project.constants";
import { projectSetupColumns, projectSetupPills, SETUP_DEFAULT_SORT } from "../project.columns";
import type { SetupTabProps } from "./tabs.types";

/** A row is its artifact: one database id, unique across the whole inventory. */
const rowId = (row: ArtifactView) => String(row.id);

/**
 * The viewer takes a Setup row. This screen goes in Part 5; until then its
 * rows open as plain inventory items, with no project lens to link to.
 */
const asItem = (a: ArtifactView): SetupRow => ({
  ...a,
  origin: "inventory",
  project_label: null,
  project_path: null,
  load_order: null,
});

/** Identity-stable, which is what `DataTable`'s memoised filtering asks of it. */
const SEARCH: DataTableSearch<ArtifactView> = {
  placeholder: SETUP_SEARCH_PLACEHOLDER,
  keys: ["name", "description", "path"],
};

/**
 * Everything configured inside this project, in one table. The Setup screen
 * splits the same rows across eight tabs because it spans every scope; here
 * the scope is fixed, so a Kind column does the work the tabs were doing and
 * the whole project stays comparable in a single sort.
 */
export function SetupTab({ artifacts, ctx, onSaved }: SetupTabProps) {
  const pills = useMemo(() => projectSetupPills(artifacts), [artifacts]);
  // An id, re-resolved against `artifacts`, so a rescan that drops the row
  // closes its sheet — the same rule the Setup screen follows.
  const [openId, setOpenId] = useState<number | null>(null);
  const open = openId === null ? null : (artifacts.find((a) => a.id === openId) ?? null);
  const close = () => setOpenId(null);
  const [tab, setTab] = useState<ViewerTab>("content");

  // A graded rule opens its Detail screen; everything else opens its sheet.
  const onRowClick = (row: ArtifactView) => {
    if (row.kind === "rule" && row.file_id) ctx.onOpen(row.file_id);
    else {
      setOpenId(row.id);
      setTab("content");
    }
  };

  return (
    <>
      <DataTable
        ariaLabel="Project setup"
        stateKey={SETUP_TABLE_KEY}
        columns={projectSetupColumns(ctx)}
        rows={artifacts}
        rowId={rowId}
        search={SEARCH}
        pills={pills}
        defaultSort={SETUP_DEFAULT_SORT}
        onRowClick={onRowClick}
        density="compact"
        empty={{ title: SETUP_EMPTY_TITLE, hint: SETUP_EMPTY_HINT }}
      />
      {open && (
        <ItemViewer
          key={open.id}
          item={asItem(open)}
          scope={scopeLabel(open, ctx.projectNames)}
          tab={tab}
          onTab={setTab}
          onClose={close}
          onSaved={onSaved}
          loadedIn={[]}
          onSelectProject={() => {}}
        />
      )}
    </>
  );
}
