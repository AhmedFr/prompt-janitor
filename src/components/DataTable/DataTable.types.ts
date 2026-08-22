import type { ColumnDef, RowData } from "@tanstack/react-table";
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

/**
 * Column defs carry their own alignment: a numeric column has to be
 * right-aligned wherever it is used, and that is a property of the column,
 * not of the screen that happens to render it.
 */
declare module "@tanstack/react-table" {
  // TanStack's ColumnMeta is generic over the row and cell types even though
  // this augmentation uses neither; the parameters must be redeclared to match.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: "left" | "right";
    /**
     * Set on a column whose cells render their own buttons (e.g. `ActionsCell`).
     * A clickable row would otherwise take `role="button"` and swallow them:
     * a widget role must not contain focusable descendants, and assistive
     * tech that honours that would leave the row actions unreachable.
     */
    interactive?: boolean;
  }
}
