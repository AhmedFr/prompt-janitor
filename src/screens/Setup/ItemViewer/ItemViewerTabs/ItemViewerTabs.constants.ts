import type { ViewerTab } from "@/App/setupTarget";

/** The viewer's tabs, in order (spec §6). */
export const TABS: readonly { id: ViewerTab; label: string }[] = [
  { id: "content", label: "Content" },
  { id: "findings", label: "Findings" },
  { id: "usage", label: "Usage" },
];

/** The tablist's name: "Viewer", so it never reads as the page's own tabs. */
export const TABLIST_LABEL = "Viewer";
