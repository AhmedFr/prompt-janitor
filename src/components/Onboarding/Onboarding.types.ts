import type { HarnessInfo, ScanSummary } from "@/lib/ipc";
import type { ScanPhase, ScanProgress } from "@/lib/useScanProgress";

/**
 * The scan events belong to {@link useScanProgress} — Setup listens to them
 * too — but they are part of this component's published surface, so the names
 * stay reachable from here.
 */
export type { ScanPhase, ScanProgress };

/**
 * Which screen of the flow is showing. `detecting` is the first paint: the
 * harness probe is a round trip, and rendering "No supported agent harness
 * found" while it is still in flight tells the user something false.
 */
export type OnboardingStep = "detecting" | "detect" | "scanning" | "reveal";

export interface OnboardingState {
  /** Harnesses found on this machine — empty means nothing is installed. */
  detected: HarnessInfo[];
  step: OnboardingStep;
  /** What the progress screen says right now. */
  status: string;
  progress: ScanProgress | null;
  summary: ScanSummary | null;
  /** Set when the scan failed; the caller hands control back to the app. */
  failed: boolean;
  /** Scan everything the detected harnesses already cover. */
  start: () => Promise<void>;
  /** Pick a folder, add it to the scanned set, and scan. No-op if cancelled. */
  addFolder: () => Promise<void>;
}

export interface OnboardingProps {
  onDone: () => void;
  /** Override the live hook (Storybook only) so a step can be pinned. */
  state?: OnboardingState;
}
