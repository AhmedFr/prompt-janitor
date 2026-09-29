import type { ViewerTab } from "@/App/setupTarget";

export interface ItemViewerTabsProps {
  active: ViewerTab;
  onChange: (tab: ViewerTab) => void;
  /** Open findings on the item; shown on the Findings tab when > 0. */
  findingsCount: number | null;
}
