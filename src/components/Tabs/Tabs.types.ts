import type { ReactNode } from "react";

/** One tab in a `Tabs` strip. */
export interface TabItem {
  id: string;
  label: string;
  /** Optional count badge, e.g. how many rows the tab's table holds. */
  count?: number;
  /**
   * Badge text for a count a single number cannot say — the Rules tabs read
   * "12/20" (enabled out of total), where `count` alone would have to pick
   * one of the two and lose the comparison that makes it worth showing.
   * Rendered verbatim in the same badge, and takes precedence over `count`.
   */
  countLabel?: string;
}

export interface TabsProps {
  items: TabItem[];
  /** The selected tab's id. `Tabs` is controlled — the caller owns this state. */
  active: string;
  onChange: (id: string) => void;
  /** Accessible name for the `tablist`. */
  ariaLabel: string;
  /** Render-prop so only the active panel's content mounts. */
  children: (active: string) => ReactNode;
}
