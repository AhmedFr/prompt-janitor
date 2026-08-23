import { Button } from "@/components/Button";
import { DataTable, type DataTableSearch } from "@/components/DataTable";
import { Icon } from "@/components/Icon";
import type { FileRow } from "@/lib/ipc";
import {
  RULES_EMPTY_HINT,
  SEE_ALL_FILES_LABEL,
  RULES_EMPTY_TITLE,
  RULES_SEARCH_PLACEHOLDER,
  RULES_TABLE_KEY,
} from "../Project.constants";
import { PROJECT_RULE_COLUMNS, RULES_DEFAULT_SORT } from "../project.columns";
import type { RulesTabProps } from "./tabs.types";

/** A row is its file: the id is the file's absolute path, unique by construction. */
const rowId = (row: FileRow) => row.id;

/**
 * Identity-stable, which is what `DataTable`'s memoised filtering asks of it.
 * The path is searched alongside the name — two files called `CLAUDE.md` in
 * one project are told apart by nothing else.
 */
const SEARCH: DataTableSearch<FileRow> = {
  placeholder: RULES_SEARCH_PLACEHOLDER,
  keys: ["name", "path", "kind"],
};

/** The graded prompt files inside this project. A row opens its Detail page. */
export function RulesTab({ files, onOpen, onSeeAll }: RulesTabProps) {
  return (
    <DataTable
      ariaLabel="Rule files"
      stateKey={RULES_TABLE_KEY}
      columns={PROJECT_RULE_COLUMNS}
      rows={files}
      rowId={rowId}
      search={SEARCH}
      defaultSort={RULES_DEFAULT_SORT}
      onRowClick={(row) => onOpen(row.id)}
      // Two files called `CLAUDE.md` in one project are told apart by nothing
      // but their path, and a column of identically-named rows is
      // indistinguishable to assistive tech.
      rowLabel={(row) => row.path}
      toolbarRight={
        <Button size="sm" onClick={onSeeAll}>
          <Icon name="prompts" /> {SEE_ALL_FILES_LABEL}
        </Button>
      }
      density="compact"
      empty={{ title: RULES_EMPTY_TITLE, hint: RULES_EMPTY_HINT }}
    />
  );
}
