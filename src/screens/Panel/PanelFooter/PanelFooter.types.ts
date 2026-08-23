import type { ScanProgressState } from "@/lib/useScanProgress";

export interface PanelFooterProps {
  /** True between "Scan now" and `scan-done`: the button locks, the bar shows. */
  scanning: boolean;
  /** The running scan's phase and counter, for the bar's status line. */
  scan: ScanProgressState;
  onScan: () => void;
  onOpenApp: () => void;
  onQuit: () => void;
}
