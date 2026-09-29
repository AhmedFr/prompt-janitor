import { useCallback, useEffect, useMemo, useState } from "react";
import type { SetupTarget } from "@/App/setupTarget";
import type { SetupFilter } from "@/lib/setupFilter";
import type { KindFilter } from "@/lib/vocabulary";
import { costThreshold } from "./setup.util";
import { applySetupFilter, setupFilterCounts } from "./setupFilter.util";
import type { SetupRow } from "./setupRows.util";

/**
 * The slice of `rows` the table shows: a kind chip, then a summary-line
 * status filter. Both start from a deep link's `target` and follow a later
 * one while Setup is mounted.
 */
export function useSetupSlice(rows: SetupRow[], target: SetupTarget | undefined) {
  // Over the whole setup, not the slice: "costly" means the same on every chip.
  const costBar = useMemo(() => costThreshold(rows), [rows]);
  const [kind, setKind] = useState<KindFilter>(target?.kind ?? "all");
  const [filter, setFilter] = useState<SetupFilter>(target?.filter ?? "all");
  useEffect(() => {
    if (target?.kind) setKind(target.kind);
  }, [target?.kind]);
  useEffect(() => {
    if (target?.filter) setFilter(target.filter);
  }, [target?.filter]);

  const kindCounts = useMemo(() => {
    const out: Partial<Record<KindFilter, number>> = { all: rows.length };
    for (const r of rows) out[r.kind] = (out[r.kind] ?? 0) + 1;
    return out;
  }, [rows]);
  const ofKind = useMemo(() => (kind === "all" ? rows : rows.filter((r) => r.kind === kind)), [rows, kind]);
  const counts = useMemo(() => setupFilterCounts(ofKind, costBar), [ofKind, costBar]);
  const visible = useMemo(() => applySetupFilter(ofKind, filter, costBar), [ofKind, filter, costBar]);
  // One Clear filters resets the chip and the summary filter (spec §4.5).
  const clearSlice = useCallback(() => {
    setKind("all");
    setFilter("all");
  }, []);

  return { kind, setKind, filter, setFilter, kindCounts, ofKind, counts, visible, clearSlice };
}
