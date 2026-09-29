import type { ViewerTab } from "@/App/setupTarget";

export interface ItemViewerTabsProps {
  active: ViewerTab;
  onChange: (tab: ViewerTab) => void;
  /** Open findings on the item; shown on the Findings tab when > 0. */
  findingsCount: number | null;
  /**
   * The Content tab holds an open draft: Findings and Usage are held, so the
   * draft cannot sit unseen behind another tab.
   */
  editing?: boolean;
}
