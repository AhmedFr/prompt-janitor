import { useCallback, useMemo } from "react";
import type { ArtifactKind, ArtifactView, SetupView } from "@/lib/ipc";
import type { TabItem } from "@/components/Tabs";
import { KIND_TABS, type ColumnsCtx } from "./setup.columns";
import {
  allArtifacts,
  costThreshold,
  pluginBundleCounts,
  projectNameMap,
  rowsByKind,
} from "./setup.util";

/** Everything the Setup screen's tables are built from, derived once per inventory. */
export interface SetupTables {
  /** One tab per kind in {@link KIND_TABS}, counted over the whole inventory. */
  tabs: TabItem[];
  /** This kind's rows — the same array identity for the lifetime of one inventory. */
  rowsFor: (kind: ArtifactKind) => ArtifactView[];
  /** What `columnsFor` closes over; identity-stable, which is what makes its cache hit. */
  ctx: ColumnsCtx;
  /** Project root path -> display name, for `pillsFor`'s Scope group. */
  projectNames: Map<string, string>;
  /** The whole setup's "high cost" bar, for `pillsFor`'s Status group. */
  costBar: number | null;
}

/** Empty rather than absent: a tab with no rows still renders, with a count of zero. */
const NO_ROWS: ArtifactView[] = [];

/**
 * Turns one `SetupView` into the tab strip and the per-kind row sets its
 * tables render, and into the `ctx` `columnsFor` keys its cache on.
 *
 * Every value here is memoised on the data it derives from and treated as
 * immutable — replaced wholesale when a rescan swaps the inventory, never
 * mutated in place. `columnsFor` and `pillsFor` both cache on the *identity*
 * of what they are handed (see their doc comments), so a screen that rebuilt
 * these inline would rebuild the column model, the filtered set and the chip
 * counts on every keystroke.
 *
 * `onOpen` is the screen's navigate-to-detail callback; it has to be stable
 * for the same reason, so the screen wraps it in `useCallback`.
 */
export function useSetupTables(
  data: SetupView | null,
  onOpen: (fileId: string) => void,
): SetupTables {
  const everything = useMemo(() => (data ? allArtifacts(data) : NO_ROWS), [data]);
  const byKind = useMemo(() => rowsByKind(everything), [everything]);
  const projectNames = useMemo(() => projectNameMap(data?.projects ?? []), [data]);
  const bundleCounts = useMemo(() => pluginBundleCounts(everything), [everything]);
  // One bar for the whole setup: a per-tab median would call half of any
  // kind's rows expensive, however cheap that kind actually is.
  const costBar = useMemo(() => costThreshold(everything), [everything]);

  const ctx = useMemo<ColumnsCtx>(
    () => ({ onOpen, projectNames, pluginBundleCounts: bundleCounts }),
    [onOpen, projectNames, bundleCounts],
  );

  const tabs = useMemo<TabItem[]>(
    () => KIND_TABS.map((tab) => ({ ...tab, count: byKind.get(tab.id)?.length ?? 0 })),
    [byKind],
  );

  const rowsFor = useCallback((kind: ArtifactKind) => byKind.get(kind) ?? NO_ROWS, [byKind]);

  return { tabs, rowsFor, ctx, projectNames, costBar };
}
