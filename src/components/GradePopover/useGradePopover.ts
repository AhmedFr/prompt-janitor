import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, isTauri } from "@/lib/ipc";
import { autoFixAll, collectFixes } from "@/lib/autoFixAll";
import { TREND_DAYS } from "./GradePopover.constants";
import type { FixResult, GradePopoverState } from "./GradePopover.types";

const EMPTY: GradePopoverState = { trend: [], openFindings: 0, fixable: 0, loading: false };
/** Open with nothing loaded yet: shown as loading, never as zeros. */
const LOADING: GradePopoverState = { ...EMPTY, loading: true };

/** Loads the trend, the open findings and the fixable count once `open`; reloads on `scan-done` while open. */
export function useGradePopover(open: boolean): GradePopoverState & { runFix: () => Promise<FixResult> } {
  const [state, setState] = useState<GradePopoverState>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!isTauri) return;
    setState((s) => ({ ...s, loading: true, error: false }));
    try {
      const [analytics, fixes] = await Promise.all([commands.getAnalytics(TREND_DAYS), collectFixes()]);
      if (analytics.status !== "ok") {
        setState({ ...EMPTY, error: true });
        return;
      }
      setState({
        trend: analytics.data.trend,
        openFindings: analytics.data.open_issues,
        fixable: fixes.reduce((n, f) => n + f.edits.length, 0),
        loading: false,
      });
      setLoaded(true);
    } catch {
      setState({ ...EMPTY, error: true });
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open || !isTauri) return;
    const off = listen("scan-done", () => void load());
    return () => void off.then((fn) => fn());
  }, [open, load]);

  const runFix = useCallback(async () => {
    const result = await autoFixAll();
    await load();
    return result;
  }, [load]);

  const shown = open && !loaded && !state.error ? LOADING : state;
  return { ...shown, runFix };
}
