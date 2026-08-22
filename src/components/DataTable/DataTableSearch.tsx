import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import type { DataTableSearchProps } from "./DataTable.types";
import { SEARCH_DEBOUNCE_MS } from "./DataTable.constants";

/**
 * The table's search box, and the only thing a keystroke re-renders.
 *
 * The draft query lives here rather than in `useDataTable` on purpose: a
 * 1 000-row table re-rendering every cell on every keypress is the difference
 * between a box that types and a box that stutters. Only the committed
 * (debounced) value crosses back up to the table.
 *
 * Two things can make the box drop what is in it, both tracked during render
 * the way `useTableState` tracks its key — an effect would run too late, after
 * a stale draft had already been committed onto the wrong table:
 *
 * - `resetKey` changes (one component rendering a different table per tab):
 *   the half-typed query belonged to the tab the user just left.
 * - `value` changes underneath us (Clear filters, restored state): the table
 *   is filtered by something the box didn't type.
 */
export function DataTableSearch({ placeholder, value, onCommit, resetKey }: DataTableSearchProps) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState({ key: resetKey, value });

  let current = draft;
  if (seen.key !== resetKey || seen.value !== value) {
    setSeen({ key: resetKey, value });
    setDraft(value);
    current = value;
  }

  // Typing updates the box immediately and the table 150 ms later, so a fast
  // typist filters once instead of once per keystroke. `current` rather than
  // `draft`: on the render that resets the box there is no pending edit left
  // to commit, and committing one would write it onto the new table's key.
  useEffect(() => {
    if (current === value) return;
    const timer = setTimeout(() => onCommit(current), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [current, value, onCommit]);

  return (
    <div className="dt__search">
      <Icon name="search" size={14} />
      <input
        type="search"
        className="dt__search-input"
        value={current}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => setDraft(event.target.value)}
      />
    </div>
  );
}
