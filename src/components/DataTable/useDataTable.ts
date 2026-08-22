import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type Table,
  type Updater,
} from "@tanstack/react-table";
import type { DataTableProps, TableState } from "./DataTable.types";
import { applyFilters, pillCounts } from "./dataTable.util";
import { useTableState } from "./useTableState";

/** How long typing settles before the table re-filters. */
export const SEARCH_DEBOUNCE_MS = 150;

/** Everything `DataTable` needs to render, with the table wiring kept out of the layout. */
export interface UseDataTable<Row> {
  table: Table<Row>;
  /** Committed (debounced, persisted) filter state. */
  state: TableState;
  /** Live search box value — ahead of `state.search` by up to the debounce. */
  query: string;
  setQuery: (value: string) => void;
  /** Cycles a column asc → desc → unsorted. */
  toggleSort: (columnId: string) => void;
  togglePill: (groupId: string, optionId: string, multi: boolean) => void;
  clearFilters: () => void;
  /** Match counts per pill group id, then per option id. */
  counts: Record<string, Record<string, number>>;
  filteredCount: number;
  total: number;
  isFiltered: boolean;
}

/**
 * Filtering runs before TanStack rather than through its column filters:
 * pill counts have to be computed over the *unfiltered* set anyway, and
 * doing both in one pass over plain arrays keeps a 1 000-row table cheap.
 * TanStack is left owning what it is good at — the sorted row model.
 */
export function useDataTable<Row>(props: DataTableProps<Row>): UseDataTable<Row> {
  const { rows, columns, rowId, search, pills, defaultSort, stateKey } = props;
  const sortId = defaultSort?.id;
  const sortDesc = defaultSort?.desc;

  const initial = useMemo<TableState>(
    () => ({ search: "", pills: {}, sort: sortId ? { id: sortId, desc: !!sortDesc } : null }),
    [sortId, sortDesc],
  );
  const [state, patch, reset] = useTableState(stateKey, initial);
  const [query, setQuery] = useState(state.search);

  // Typing updates the box immediately and the table 150 ms later, so a fast
  // typist filters once instead of once per keystroke.
  useEffect(() => {
    if (query === state.search) return;
    const timer = setTimeout(() => patch({ search: query }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, state.search, patch]);

  const filtered = useMemo(
    () => applyFilters(rows, state, search, pills),
    [rows, state, search, pills],
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

  const togglePill = useCallback(
    (groupId: string, optionId: string, multi: boolean) => {
      const current = state.pills[groupId] ?? [];
      const next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : multi
          ? [...current, optionId]
          : [optionId];
      patch({ pills: { ...state.pills, [groupId]: next } });
    },
    [patch, state.pills],
  );

  const clearFilters = useCallback(() => {
    setQuery("");
    reset();
  }, [reset]);

  const counts = useMemo(() => {
    const out: Record<string, Record<string, number>> = {};
    for (const group of pills ?? []) out[group.id] = pillCounts(rows, group);
    return out;
  }, [rows, pills]);

  const isFiltered =
    state.search.trim().length > 0 || Object.values(state.pills).some((ids) => ids.length > 0);

  return {
    table,
    state,
    query,
    setQuery,
    toggleSort,
    togglePill,
    clearFilters,
    counts,
    filteredCount: filtered.length,
    total: rows.length,
    isFiltered,
  };
}
