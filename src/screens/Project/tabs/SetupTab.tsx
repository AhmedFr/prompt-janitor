import { useMemo } from "react";
import { DataTable, type DataTableSearch } from "@/components/DataTable";
import type { ArtifactView } from "@/lib/ipc";
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
export function SetupTab({ artifacts, ctx }: SetupTabProps) {
  const pills = useMemo(() => projectSetupPills(artifacts), [artifacts]);

  return (
    <DataTable
      ariaLabel="Project setup"
      stateKey={SETUP_TABLE_KEY}
      columns={projectSetupColumns(ctx)}
      rows={artifacts}
      rowId={rowId}
      search={SEARCH}
      pills={pills}
      defaultSort={SETUP_DEFAULT_SORT}
      density="compact"
      empty={{ title: SETUP_EMPTY_TITLE, hint: SETUP_EMPTY_HINT }}
    />
  );
}
