import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { isTauri } from "./ipc";

/** Which half of the scan the core is in, as broadcast on `scan-phase`. */
export type ScanPhase = "harness" | "files";

/** The `scan-progress` payload: files graded so far, out of how many. */
export interface ScanProgress {
  done: number;
  total: number;
}

/** What a scan is doing right now, as far as the events have said. */
export interface ScanProgressState {
  phase: ScanPhase | null;
  progress: ScanProgress | null;
}

/**
 * Follows a running scan by listening to the two events the core emits.
 *
 * Onboarding is not the only place a scan can start — the Setup screen has a
 * Rescan button — and a progress bar that only exists on the first run leaves
 * every later scan looking like a frozen screen. One hook, one bar, both
 * places.
 */
export function useScanProgress(): ScanProgressState {
  const [phase, setPhase] = useState<ScanPhase | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);

  useEffect(() => {
    // Outside the desktop runtime there is no event bus to subscribe to, and
    // `listen` would hand back a rejected promise nobody is waiting on.
    if (!isTauri) return;
    const phases = listen<ScanPhase>("scan-phase", (e) => setPhase(e.payload));
    const progresses = listen<ScanProgress>("scan-progress", (e) => setProgress(e.payload));
    return () => {
      void phases.then((fn) => fn());
      void progresses.then((fn) => fn());
    };
  }, []);

  return { phase, progress };
}

const HARNESS_STATUS = (name: string) => `Indexing ${name} sessions…`;

/**
 * The line under a scan's progress bar: which phase, and how far into it.
 * Shared so onboarding and the Setup screen narrate a scan the same way.
 */
export function scanStatusLine(
  phase: ScanPhase | null,
  progress: ScanProgress | null,
  harnessName: string,
): string {
  if (phase === "harness") return HARNESS_STATUS(harnessName);
  if (phase === "files" && progress) return `Grading ${progress.done}/${progress.total} files`;
  if (phase === "files") return "Grading prompt files…";
  return "Looking around…";
}

/** How full the bar is drawn, 0–100. A scan with no counter yet shows a stub. */
export function scanPercent(progress: ScanProgress | null): number {
  return progress && progress.total ? (progress.done / progress.total) * 100 : 8;
}
