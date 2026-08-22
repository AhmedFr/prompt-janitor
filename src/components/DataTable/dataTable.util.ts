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

/**
 * Drops selected option ids that no longer exist, and any group left with
 * nothing selected (or gone from `groups` entirely).
 *
 * A table's remembered selection outlives the options it named: a project
 * pill for a project the last scan removed, a plugin pill for an install
 * that was uninstalled, a whole group a screen stopped rendering. Left in
 * place, {@link matchesPills} finds no surviving option to satisfy and fails
 * *every* row — an empty table, "No rows match", and no chip pressed to
 * un-press. Pruning is applied to the state the table filters and counts by,
 * not to the state it persists: nothing is thrown away, it just cannot
 * filter by a chip that is not on screen.
 */
export function prunePills<Row>(
  selected: Record<string, string[]>,
  groups: PillGroup<Row>[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const group of groups) {
    const ids = selected[group.id];
    if (!ids || ids.length === 0) continue;
    const live = ids.filter((id) => group.options.some((option) => option.id === id));
    if (live.length > 0) out[group.id] = live;
  }
  return out;
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

/**
 * Chip counts that answer the only question a chip is ever asked: "how many
 * rows would I get if I clicked this?". Each group counts over the rows the
 * search and the *other* groups already kept, excluding its own selection —
 * so a count is never a promise the table can't keep (a chip reading 12 that
 * yields 3 once the search is on), and picking one chip in a group never
 * zeroes its siblings, which is how the user un-picks it.
 *
 * A group whose every option ships a `count` (a Rust rollup, say) is skipped:
 * the caller already knows, and a faceted pass over every row would be waste.
 */
export function facetedPillCounts<Row>(
  rows: Row[],
  groups: PillGroup<Row>[],
  state: TableState,
  search: DataTableProps<Row>["search"] | undefined,
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const group of groups) {
    if (group.options.every((option) => option.count != null)) continue;
    const others = { ...state, pills: { ...state.pills, [group.id]: [] }, sort: null };
    out[group.id] = pillCounts(applyFilters(rows, others, search, groups), group);
  }
  return out;
}
