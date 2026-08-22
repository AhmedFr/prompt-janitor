import { useEffect, useRef, useState } from "react";
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
 * - `value` changes to something this box didn't itself commit (Clear
 *   filters, restored state): the table is filtered by something the box
 *   didn't type.
 *
 * `value` changing to what this box *did* just commit does not reset the
 * draft. Without that distinction, a keystroke that lands between the
 * debounce firing and the parent's re-render — typing "o" right after "brav"
 * commits — would be wiped out when `value="brav"` arrives, because it looks
 * indistinguishable from an external reset. `lastCommittedRef` is what makes
 * the two cases tell apart.
 */
export function DataTableSearch({ placeholder, value, onCommit, resetKey }: DataTableSearchProps) {
  const [draft, setDraft] = useState(value);
  const [seenKey, setSeenKey] = useState(resetKey);
  // Plain refs, not state: both are read-then-written on every render (or on
  // the debounce timer, off the render cycle entirely) purely to compare
  // against the *next* render — they never need to cause one themselves.
  const prevValueRef = useRef(value);
  const lastCommittedRef = useRef(value);

  let current = draft;
  const valueChangedFromOutside = value !== prevValueRef.current;
  // A `value` change is only a reset when it isn't just this box's own
  // commit echoing back. `lastCommittedRef` is set the moment the debounce
  // fires, before the parent has re-rendered with it — comparing against it
  // (rather than against `value` alone) is what keeps that echo from
  // stomping on a keystroke that landed in between. `prevValueRef` gates the
  // comparison on the prop having actually changed since the last render, so
  // an unrelated reset can't be masked by `value` having cycled back to
  // something equal to a stale `prevValueRef`.
  if (seenKey !== resetKey || (valueChangedFromOutside && value !== lastCommittedRef.current)) {
    setSeenKey(resetKey);
    setDraft(value);
    current = value;
  }
  prevValueRef.current = value;

  // Typing updates the box immediately and the table 150 ms later, so a fast
  // typist filters once instead of once per keystroke. `current` rather than
  // `draft`: on the render that resets the box there is no pending edit left
  // to commit, and committing one would write it onto the new table's key.
  useEffect(() => {
    if (current === value) return;
    const timer = setTimeout(() => {
      // Recorded before the parent re-renders with this same value, so that
      // render doesn't mistake our own commit for an external reset and
      // stomp on whatever's been typed since.
      lastCommittedRef.current = current;
      onCommit(current);
    }, SEARCH_DEBOUNCE_MS);
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
