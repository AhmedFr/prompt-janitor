import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type Table,
  type Updater,
} from "@tanstack/react-table";
import type { DataTableProps, TableState } from "./DataTable.types";
import { applyFilters, facetedPillCounts, prunePills } from "./dataTable.util";
import { useTableState } from "./useTableState";

/** Everything `DataTable` needs to render, with the table wiring kept out of the layout. */
export interface UseDataTable<Row> {
  table: Table<Row>;
  /** Committed (debounced, persisted) filter state. */
  state: TableState;
  /** Commits a query — `DataTableSearch` owns the keystrokes and calls this once typing settles. */
  setSearch: (value: string) => void;
  /** Cycles a column asc → desc → unsorted. */
  toggleSort: (columnId: string) => void;
  togglePill: (groupId: string, optionId: string, multi: boolean) => void;
  clearFilters: () => void;
  /** Match counts per pill group id, then per option id (faceted — see `facetedPillCounts`). */
  counts: Record<string, Record<string, number>>;
  filteredCount: number;
  total: number;
  isFiltered: boolean;
}

/**
 * Filtering runs before TanStack rather than through its column filters: pill
 * counts have to be computed over sibling-faceted slices anyway, and doing it
 * all in passes over plain arrays keeps a 1 000-row table cheap. TanStack is
 * left owning what it is good at — the sorted row model.
 */
export function useDataTable<Row>(props: DataTableProps<Row>): UseDataTable<Row> {
  const { rows, columns, rowId, search, pills, initialPills, defaultSort, stateKey } = props;
  const sortId = defaultSort?.id;
  const sortDesc = defaultSort?.desc;

  const initial = useMemo<TableState>(
    () => ({ search: "", pills: {}, sort: sortId ? { id: sortId, desc: !!sortDesc } : null }),
    [sortId, sortDesc],
  );
  const [state, patch] = useTableState(stateKey, initial);

  // A deep link's selection, written over the remembered one — once per
  // selection, never per render, so the chip it presses can still be
  // un-pressed. Tracked by identity rather than by value: the same link
  // followed twice is the same request, and re-applying it would fight the
  // user for their own filters.
  const appliedInitial = useRef<Record<string, string[]> | undefined>(undefined);
  useEffect(() => {
    if (!initialPills || appliedInitial.current === initialPills) return;
    appliedInitial.current = initialPills;
    patch({ pills: initialPills });
  }, [initialPills, patch]);

  // `pills`/`search` are documented as identity-stable (see `DataTableProps`),
  // but a caller that mutates a stable array in place would otherwise leave
  // these memos holding a filtered set the definitions no longer describe.
  // Cheap to compute, and the only thing standing between that mistake and a
  // table that quietly lies.
  const pillsKey = (pills ?? []).map((group) => group.id).join(" ");
  const searchKey = search?.keys.length ?? 0;

  // What the table actually filters by: the remembered selection minus any
  // chip that is no longer on screen. See `prunePills` — an option that
  // vanished (a rescanned-away project, an uninstalled plugin) would
  // otherwise empty the table with nothing pressed to un-press.
  const selectedPills = useMemo(
    () => prunePills(state.pills, pills ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.pills, pills, pillsKey],
  );

  // Deliberately not keyed on the whole `state`: sorting is TanStack's job,
  // and re-filtering every row because a header was clicked is wasted work.
  const filtered = useMemo(
    () => applyFilters(rows, { search: state.search, pills: selectedPills, sort: null }, search, pills),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, state.search, selectedPills, search, pills, pillsKey, searchKey],
  );

  const sorting = useMemo<SortingState>(
    () => (state.sort ? [{ id: state.sort.id, desc: state.sort.desc }] : []),
    [state.sort],
  );

  const onSortingChange = useCallback(
    (updater: Updater<SortingState>) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      const first = next[0];
      patch({ sort: first ? { id: first.id, desc: first.desc } : null });
    },
    [patch, sorting],
  );

  const table = useReactTable<Row>({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange,
    getRowId: (row) => rowId(row),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const setSearch = useCallback((value: string) => patch({ search: value }), [patch]);

  // Always asc first, whatever the column type: a table where some headers
  // start descending and others ascending is a table nobody can predict.
  const toggleSort = useCallback(
    (columnId: string) => {
      const current = state.sort;
      if (!current || current.id !== columnId) return patch({ sort: { id: columnId, desc: false } });
      if (!current.desc) return patch({ sort: { id: columnId, desc: true } });
      return patch({ sort: null });
    },
    [patch, state.sort],
  );

  // Built on the pruned selection, so pressing any chip also writes the dead
  // ids out of storage rather than carrying them along forever.
  const togglePill = useCallback(
    (groupId: string, optionId: string, multi: boolean) => {
      const current = selectedPills[groupId] ?? [];
      const next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : multi
          ? [...current, optionId]
          : [optionId];
      patch({ pills: { ...selectedPills, [groupId]: next } });
    },
    [patch, selectedPills],
  );

  // Clears the *filters*, not the view: the sort is the order the user chose to
  // read in, and throwing it away on "no rows match" loses their place too.
  const clearFilters = useCallback(() => patch({ search: "", pills: {} }), [patch]);

  // Keyed on the filter state only: re-counting every chip because a header
  // was clicked would be the same wasted pass `filtered` avoids.
  const counts = useMemo(
    () =>
      facetedPillCounts(
        rows,
        pills ?? [],
        { search: state.search, pills: selectedPills, sort: null },
        search,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, pills, state.search, selectedPills, search, pillsKey, searchKey],
  );

  // A pruned-away selection is not a filter the user can see, so it must not
  // put the table into the "N of M rows" state either.
  /**
   * `state.pills` is the *remembered* selection; what the table filtered and
   * counted by is the pruned view of it, and that is what `DataTable` has to
   * read back when deciding which chips look pressed.
   */
  const exposedState = useMemo(
    () => ({ ...state, pills: selectedPills }),
    [state, selectedPills],
  );

  const isFiltered =
    state.search.trim().length > 0 || Object.values(selectedPills).some((ids) => ids.length > 0);

  return {
    table,
    state: exposedState,
    setSearch,
    toggleSort,
    togglePill,
    clearFilters,
    counts,
    filteredCount: filtered.length,
    total: rows.length,
    isFiltered,
  };
}
