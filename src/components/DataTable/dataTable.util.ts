import type { DataTableProps, PillGroup, TableState } from "./DataTable.types";

/** The `keys` shape a table's `search` config carries, with the optional wrapper stripped. */
type SearchKeys<Row> = NonNullable<DataTableProps<Row>["search"]>["keys"];

/** Resolves one search key against a row, lower-cased for case-insensitive matching. */
function resolveKey<Row>(row: Row, key: SearchKeys<Row>[number]): string {
  const value = typeof key === "function" ? key(row) : row[key];
  return String(value ?? "").toLowerCase();
}

/**
 * Whether `row` satisfies a free-text query: every whitespace-separated
 * token in `query` must appear as a substring of at least one resolved key
 * (tokens AND together; a token may come from a different key than its
 * neighbors — "web rule" matches a row named "web-rules" of kind "rule").
 * An empty or whitespace-only query matches everything.
 */
export function matchesSearch<Row>(row: Row, query: string, keys: SearchKeys<Row>): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const values = keys.map((key) => resolveKey(row, key));
  return tokens.every((token) => values.some((value) => value.includes(token)));
}

/**
 * Whether `row` satisfies the current pill selection: groups AND together,
 * options within a group OR together. A group with nothing selected is not
 * a filter — every row passes it.
 */
export function matchesPills<Row>(
  row: Row,
  groups: PillGroup<Row>[],
  selected: Record<string, string[]>,
): boolean {
  return groups.every((group) => {
    const selectedIds = selected[group.id];
    if (!selectedIds || selectedIds.length === 0) return true;
    return group.options
      .filter((option) => selectedIds.includes(option.id))
      .some((option) => option.predicate(row));
  });
}

/** Composes search and pill filtering into the slice a table actually renders. */
export function applyFilters<Row>(
  rows: Row[],
  state: TableState,
  search: DataTableProps<Row>["search"] | undefined,
  groups: PillGroup<Row>[] | undefined,
): Row[] {
  return rows.filter((row) => {
    if (search && state.search.trim() && !matchesSearch(row, state.search, search.keys)) {
      return false;
    }
    if (groups && groups.length > 0 && !matchesPills(row, groups, state.pills)) {
      return false;
    }
    return true;
  });
}

/**
 * How many of `rows` match each option in `group`, independent of what's
 * currently selected — the count a chip shows before the user clicks it.
 */
export function pillCounts<Row>(rows: Row[], group: PillGroup<Row>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const option of group.options) {
    counts[option.id] = rows.filter((row) => option.predicate(row)).length;
  }
  return counts;
}
