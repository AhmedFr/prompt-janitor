import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { commands, type HarnessInfo, type ScanSummary } from "@/lib/ipc";
import { addExtraFolder } from "@/lib/scan-actions";
import { scanStatusLine, useScanProgress } from "@/lib/useScanProgress";
import type { OnboardingState, OnboardingStep } from "./Onboarding.types";

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
  const [step, setStep] = useState<OnboardingStep>("detecting");
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const { phase, progress } = useScanProgress();

  useEffect(() => {
    let live = true;
    void commands
      .listHarnesses()
      .then((res) => {
        if (live && res.status === "ok") setDetected(res.data.filter((h) => h.detected));
      })
      .catch(() => {
        // A probe that throws is indistinguishable from an empty machine, and
        // the folder picker is the right way out of both.
        if (live) setDetected([]);
      })
      .finally(() => {
        // Only the first paint waits on detection; a scan already under way
        // must not be dragged back to the detect screen.
        if (live) setStep((current) => (current === "detecting" ? "detect" : current));
      });
    return () => {
      live = false;
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
    status: scanStatusLine(phase, progress, harnessName),
    progress,
    summary,
    failed,
    start: scan,
    addFolder,
  };
}
