import { useCallback, useMemo } from "react";
import { applySetupFilter, costThreshold, setupFilterCounts, type SetupFilter } from "@/lib/setupFilter";
import type { KindFilter } from "@/lib/vocabulary";
import type { SetupRow } from "@/lib/setupRows";
import type { SetupTargetControl } from "./Setup.types";

/**
 * The slice of `rows` the table shows: a kind chip, then a summary-line
 * status filter. Both are read from Setup's target, and a change is a new
 * place (a push), so Back restores the slice. "All" is stored as absent, so
 * the same slice is always the same state. While usage is unknown
 * (`usageKnown` false) the status filter is held, not applied: every usage
 * row would read as never used.
 */
export function useSetupSlice(rows: SetupRow[], { value, change }: SetupTargetControl, usageKnown = true) {
  // Over the whole setup, not the slice: "costly" means the same on every chip.
  const costBar = useMemo(() => costThreshold(rows), [rows]);
  const kind: KindFilter = value.kind ?? "all";
  const filter: SetupFilter = value.filter ?? "all";
  const setKind = useCallback(
    (next: KindFilter) => change({ ...value, kind: next === "all" ? undefined : next }, "push"),
    [value, change],
  );
  const setFilter = useCallback(
    (next: SetupFilter) => change({ ...value, filter: next === "all" ? undefined : next }, "push"),
    [value, change],
  );

  const kindCounts = useMemo(() => {
    const out: Partial<Record<KindFilter, number>> = { all: rows.length };
    for (const r of rows) out[r.kind] = (out[r.kind] ?? 0) + 1;
    return out;
  }, [rows]);
  const ofKind = useMemo(() => (kind === "all" ? rows : rows.filter((r) => r.kind === kind)), [rows, kind]);
  const counts = useMemo(() => setupFilterCounts(ofKind, costBar), [ofKind, costBar]);
  const visible = useMemo(
    () => (usageKnown ? applySetupFilter(ofKind, filter, costBar) : ofKind),
    [ofKind, filter, costBar, usageKnown],
  );
  // One Clear filters resets the chip and the summary filter (spec §4.5).
  const clearSlice = useCallback(
    () => change({ ...value, kind: undefined, filter: undefined }, "push"),
    [value, change],
  );

  return { kind, setKind, filter, setFilter, kindCounts, ofKind, counts, visible, clearSlice };
}
