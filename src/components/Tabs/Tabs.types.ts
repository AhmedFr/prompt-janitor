import type { ReactNode } from "react";

/** One tab in a `Tabs` strip. */
export interface TabItem {
  id: string;
  label: string;
  /** Optional count badge, e.g. how many rows the tab's table holds. */
  count?: number;
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
