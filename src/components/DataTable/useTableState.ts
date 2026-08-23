import { useCallback, useState } from "react";
import type { TableState } from "./DataTable.types";

/** Prefix every table's sessionStorage entry shares, namespaced under the app. */
const STORAGE_PREFIX = "pj.table.";

/**
 * Where one table's remembered state lives. Exported so a caller with a
 * reason to drop it — `useRulesNew` clears the destination tab's filters so a
 * remembered search cannot hide the row it just created — never has to spell
 * the prefix out and drift from this file.
 */
export function tableStorageKey(stateKey: string): string {
  return STORAGE_PREFIX + stateKey;
}

/**
 * Outside the browser (SSR, Storybook's node renderer, tests that stub
 * `window` away) there is no session to persist into.
 */
function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.sessionStorage;
}

/** `sort` is either absent (unsorted) or a well-formed column reference. */
function isSort(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === "string" && typeof candidate.desc === "boolean";
}

/**
 * Loose shape check so a hand-edited or stale-schema value doesn't get trusted
 * verbatim. `sort` is validated too: a malformed entry would be handed
 * straight to TanStack's sorting state, where a missing `id` sorts by nothing
 * and a string `desc` silently reverses the table.
 */
function isTableState(value: unknown): value is TableState {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.search === "string" &&
    typeof candidate.pills === "object" &&
    candidate.pills !== null &&
    isSort(candidate.sort)
  );
}

function readStored(key: string, initial: TableState): TableState {
  if (!canUseStorage()) return initial;
  try {
    const raw = window.sessionStorage.getItem(tableStorageKey(key));
    if (!raw) return initial;
    const parsed: unknown = JSON.parse(raw);
    return isTableState(parsed) ? parsed : initial;
  } catch {
    // Corrupt JSON, or storage access denied (e.g. private-mode restrictions).
    return initial;
  }
}

function writeStored(key: string, state: TableState): void {
  if (!canUseStorage()) return;
  try {
    window.sessionStorage.setItem(tableStorageKey(key), JSON.stringify(state));
  } catch {
    // Storage full or unavailable — the table just won't remember this session.
  }
}

function clearStored(key: string): void {
  if (!canUseStorage()) return;
  try {
    window.sessionStorage.removeItem(tableStorageKey(key));
  } catch {
    // Nothing to do if removal itself is blocked.
  }
}

/**
 * A `DataTable`'s search/pills/sort, remembered per table in `sessionStorage`
 * under `pj.table.<key>` so switching screens and coming back doesn't lose
 * the filter the user set up. `key` should be stable and unique per table
 * instance on the page (see `DataTableProps.stateKey`).
 */
export function useTableState(
  key: string,
  initial: TableState,
): [TableState, (patch: Partial<TableState>) => void, () => void] {
  // Key and state are one value, not two: a `patch` that read the key from a
  // closure could write the previous tab's filters under the new tab's key in
  // the render between them. Held together, every write names the key the
  // state it merges into was loaded from.
  const [loaded, setLoaded] = useState<{ key: string; state: TableState }>(() => ({
    key,
    state: readStored(key, initial),
  }));

  // One component can render a different table per tab, changing `key` without
  // unmounting. Adjusting during render rather than in an effect keeps the
  // previous tab's filters from being painted under the new tab's key — and
  // the fresh state is returned by *this* pass, so a caller deriving its own
  // state from ours (the search box) never sees the old table's query.
  let current = loaded;
  if (loaded.key !== key) {
    current = { key, state: readStored(key, initial) };
    setLoaded(current);
  }

  const patch = useCallback((next: Partial<TableState>) => {
    setLoaded((prev) => {
      const merged = { ...prev.state, ...next };
      writeStored(prev.key, merged);
      return { key: prev.key, state: merged };
    });
  }, []);

  const reset = useCallback(() => {
    setLoaded((prev) => {
      clearStored(prev.key);
      return { key: prev.key, state: initial };
    });
  }, [initial]);

  return [current.state, patch, reset];
}
