import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { commands, type HarnessInfo, type ScanSummary } from "@/lib/ipc";
import { addExtraFolder } from "@/lib/scan-actions";

/** Which half of the scan the core is in, as broadcast on `scan-phase`. */
export type ScanPhase = "harness" | "files";

/** The `scan-progress` payload: files graded so far, out of how many. */
export interface ScanProgress {
  done: number;
  total: number;
}

/** Which screen of the flow is showing. */
export type OnboardingStep = "detect" | "scanning" | "reveal";

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

const HARNESS_STATUS = (name: string) => `Indexing ${name} sessions…`;

/** The line under the progress bar: which phase, and how far into it. */
function statusLine(
  phase: ScanPhase | null,
  progress: ScanProgress | null,
  harnessName: string,
): string {
  if (phase === "harness") return HARNESS_STATUS(harnessName);
  if (phase === "files" && progress) return `Grading ${progress.done}/${progress.total} files`;
  if (phase === "files") return "Grading prompt files…";
  return "Looking around…";
}

/**
 * First-run logic: find out what is installed, then scan it.
 *
 * A detected harness already knows where the prompts live — its own projects
 * and its global layer — so the first scan needs no folder at all. Picking one
 * is the escape hatch for prompts kept somewhere no harness ever opened, and it
 * *adds* to whatever is already configured rather than replacing it.
 */
export function useOnboarding(): OnboardingState {
  const [detected, setDetected] = useState<HarnessInfo[]>([]);
  const [step, setStep] = useState<OnboardingStep>("detect");
  const [phase, setPhase] = useState<ScanPhase | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void commands.listHarnesses().then((res) => {
      if (res.status === "ok") setDetected(res.data.filter((h) => h.detected));
    });
  }, []);

  useEffect(() => {
    const phases = listen<ScanPhase>("scan-phase", (e) => setPhase(e.payload));
    const progresses = listen<ScanProgress>("scan-progress", (e) => setProgress(e.payload));
    return () => {
      void phases.then((fn) => fn());
      void progresses.then((fn) => fn());
    };
  }, []);

  const scan = useCallback(async () => {
    setStep("scanning");
    const res = await commands.scanNow();
    if (res.status === "ok") {
      setSummary(res.data);
      setStep("reveal");
      return;
    }
    // Don't trap the user in onboarding behind a scan that will not run.
    setStep("detect");
    setFailed(true);
  }, []);

  const addFolder = useCallback(async () => {
    const dir = await open({ directory: true, multiple: false, title: "Choose a folder to scan" });
    if (typeof dir !== "string") return;
    await addExtraFolder(dir);
    await scan();
  }, [scan]);

  const harnessName = detected[0]?.display_name ?? "agent";

  return {
    detected,
    step,
    status: statusLine(phase, progress, harnessName),
    progress,
    summary,
    failed,
    start: scan,
    addFolder,
  };
}
