import { useCallback, useState } from "react";
import type { TableState } from "./DataTable.types";

/** Prefix every table's sessionStorage entry shares, namespaced under the app. */
const STORAGE_PREFIX = "pj.table.";

/**
 * Outside the browser (SSR, Storybook's node renderer, tests that stub
 * `window` away) there is no session to persist into.
 */
function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.sessionStorage;
}

/** Loose shape check so a hand-edited or stale-schema value doesn't get trusted verbatim. */
function isTableState(value: unknown): value is TableState {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.search === "string" && typeof candidate.pills === "object" && candidate.pills !== null;
}

function readStored(key: string, initial: TableState): TableState {
  if (!canUseStorage()) return initial;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + key);
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
    window.sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(state));
  } catch {
    // Storage full or unavailable — the table just won't remember this session.
  }
}

function clearStored(key: string): void {
  if (!canUseStorage()) return;
  try {
    window.sessionStorage.removeItem(STORAGE_PREFIX + key);
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
  const [state, setState] = useState<TableState>(() => readStored(key, initial));

  const patch = useCallback(
    (next: Partial<TableState>) => {
      setState((prev) => {
        const merged = { ...prev, ...next };
        writeStored(key, merged);
        return merged;
      });
    },
    [key],
  );

  const reset = useCallback(() => {
    clearStored(key);
    setState(initial);
  }, [key, initial]);

  return [state, patch, reset];
}
