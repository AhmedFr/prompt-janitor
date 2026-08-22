import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";

/** One selectable chip within a {@link PillGroup}. */
export interface PillOption<Row> {
  id: string;
  label: string;
  /** Whether `r` belongs in this chip's slice. */
  predicate: (r: Row) => boolean;
  /** Precomputed match count, when the caller wants to skip {@link pillCounts}. */
  count?: number;
}

/**
 * A row of related chips above a table — "kind: rule / prompt / skill",
 * "status: errors / never used". Groups AND together; options within a
 * group OR together (see `matchesPills` in `dataTable.util.ts`).
 */
export interface PillGroup<Row> {
  id: string;
  label: string;
  options: PillOption<Row>[];
  /** Whether more than one chip in this group may be selected at once. */
  multi?: boolean;
}

/** What a single `DataTable` remembers about itself, keyed per table. */
export interface TableState {
  search: string;
  /** Selected option ids, keyed by {@link PillGroup.id}. */
  pills: Record<string, string[]>;
  sort: { id: string; desc: boolean } | null;
}

/** How a `DataTable` resolves rows to searchable text. */
export interface DataTableSearch<Row> {
  placeholder: string;
  keys: (keyof Row | ((r: Row) => string))[];
}

export interface DataTableProps<Row> {
  // A row's columns can each project a different cell value type (string
  // grade, number score, ReactNode action button…), so a single TValue
  // parameter can't describe the array — this mirrors TanStack's own
  // `ColumnDef<T, any>[]` convention for heterogeneous column lists.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<Row, any>[];
  rows: Row[];
  rowId: (r: Row) => string;
  search?: DataTableSearch<Row>;
  pills?: PillGroup<Row>[];
  defaultSort?: { id: string; desc?: boolean };
  onRowClick?: (r: Row) => void;
  empty: { title: string; hint?: string };
  density?: "compact" | "regular";
  virtualize?: boolean;
  toolbarRight?: ReactNode;
  /** Suffix of the `pj.table.<key>` sessionStorage key this table persists under. */
  stateKey: string;
  ariaLabel: string;
}
