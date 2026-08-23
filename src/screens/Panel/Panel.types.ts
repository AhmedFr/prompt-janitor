import type { PanelSnapshot } from "@/lib/ipc";
import type { ScanProgressState } from "@/lib/useScanProgress";

/** The three answers the panel can give to "is my setup good enough?". */
export type Verdict = "Good enough" | "Needs work" | "Fix now";

/** How a signal chip is painted: something to deal with, or nothing to say. */
export type SignalTone = "error" | "ok";

export interface PanelProps {
  /** Override the live snapshot (Storybook only); `usePanel` supplies it in the app. */
  data?: PanelSnapshot | null;
  /** Force the failure panel (Storybook only). */
  failed?: boolean;
  /** Force the running-scan state (Storybook only). */
  scanning?: boolean;
}

/** What {@link usePanel} hands the panel. */
export interface PanelState {
  data: PanelSnapshot | null;
  loading: boolean;
  /** True between "Scan now" and the `scan-done` event. */
  scanning: boolean;
  /** The running scan's phase and counter, for the bar under the button. */
  scan: ScanProgressState;
  refetch: () => Promise<void>;
  startScan: () => Promise<void>;
}
