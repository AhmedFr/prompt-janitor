import type { PanelSnapshot } from "@/lib/ipc";

export interface PanelHeaderProps {
  /** The whole snapshot: the header is what changes when `has_data` is false. */
  snapshot: PanelSnapshot;
  /** Anchor for the relative "scanned …" line. Defaults to the current clock. */
  now?: Date;
}
