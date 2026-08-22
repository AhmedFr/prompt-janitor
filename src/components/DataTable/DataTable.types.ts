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

/**
 * `columns`, `pills` and `search` must be **identity-stable** — `useMemo`d in
 * the caller, or (better) built once at module level and looked up per kind
 * (see `columnsFor`/`pillsFor` in the Setup screen). They feed memoised
 * filtering, counting and TanStack's own column model; an inline literal
 * rebuilt every render rebuilds all three on every keystroke.
 *
 * Content changes under a stable identity are still noticed: the memos also
 * key on the pill group ids and the search key count, so a definition list
 * swapped in place doesn't leave a stale table behind.
 */
export interface DataTableProps<Row> {
  // A row's columns can each project a different cell value type (string
  // grade, number score, ReactNode action button…), so a single TValue
  // parameter can't describe the array — this mirrors TanStack's own
  // `ColumnDef<T, any>[]` convention for heterogeneous column lists.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<Row, any>[];
  rows: Row[];
  rowId: (r: Row) => string;
  /** Identity-stable, per the note above. */
  search?: DataTableSearch<Row>;
  /** Identity-stable, per the note above. */
  pills?: PillGroup<Row>[];
  defaultSort?: { id: string; desc?: boolean };
  /**
   * Makes rows openable. A clickable row gets `tabIndex=0`, an `aria-label`
   * and Enter/Space — but never `role="button"`: a widget role must not
   * contain focusable descendants, and rows carry their own action buttons.
   * Clicks and keystrokes that land on a control inside the row are that
   * control's, never the row's.
   */
  onRowClick?: (r: Row) => void;
  /**
   * Accessible name for a clickable row. Defaults to the first column's
   * rendered value, falling back to {@link DataTableProps.rowId}.
   */
  rowLabel?: (r: Row) => string;
  /**
   * The row to land on: it takes `dt__row--highlight` and is scrolled to the
   * middle of the table on mount, so "open the rule that caused this" arrives
   * at the rule rather than at the top of a list containing it.
   */
  highlightRowId?: string;
  /** Extra class per row — a screen's own state (stale, failing) on its rows. */
  rowClassName?: (r: Row) => string | undefined;
  /**
   * Rows are on their way. The body renders a skeleton and the table is
   * `aria-busy`, so an empty table never claims "nothing here" before the
   * answer has arrived.
   */
  loading?: boolean;
  empty: { title: string; hint?: string };
  density?: "compact" | "regular";
  /**
   * Defaults to `true` and costs nothing below `VIRTUAL_THRESHOLD` rows —
   * a table only starts windowing when it is big enough to need it. Pass
   * `false` for a table whose every row must be in the DOM (print, export).
   */
  virtualize?: boolean;
  toolbarRight?: ReactNode;
  /**
   * Suffix of the `pj.table.<key>` sessionStorage key this table persists
   * under. Changing it mid-mount (one component rendering a different table
   * per tab) swaps the remembered view over to that key's stored state
   * instead of carrying the old one across.
   */
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
  }
}

/** What the search box owns, kept out of the table so typing re-renders only it. */
export interface DataTableSearchProps {
  placeholder: string;
  /** The committed query — what the table is actually filtered by. */
  value: string;
  /** Called when typing settles, with the query to filter on. */
  onCommit: (value: string) => void;
  /**
   * Identifies the table the box belongs to. When it changes the box drops
   * whatever was half-typed and adopts `value` — the new table's own
   * remembered search — instead of committing the old table's query onto it.
   */
  resetKey: string;
}
