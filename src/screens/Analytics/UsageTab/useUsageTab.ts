import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, isTauri, type UsageOverview } from "@/lib/ipc";

/**
 * Loads the harness usage overview for the Analytics → Usage tab over the last
 * `windowDays`, refetching when the toolbar's range changes and whenever a
 * scan finishes (the scan is what re-indexes the transcripts).
 *
 * Every write is gated on a generation counter, because these reads outlive
 * the window they were started for. Switching 7d → 90d leaves the 7d read in
 * flight; without the gate it lands last and wins, painting a week of usage
 * under a toolbar that says 90d — and the same read landing after the tab is
 * gone would write to a screen nobody is looking at.
 */
export function useUsageTab(windowDays: number) {
  const [data, setData] = useState<UsageOverview | null>(null);
  const [loading, setLoading] = useState(true);
  // Bumped whenever a read is started or superseded; a read may only write
  // while the counter still holds the value it claimed on entry.
  const generation = useRef(0);

  const refetch = useCallback(async () => {
    const mine = ++generation.current;
    const fresh = () => generation.current === mine;

    if (!isTauri) {
      setLoading(false);
      return;
    }
    const res = await commands.getUsageOverview(windowDays);
    if (!fresh()) return;
    if (res.status === "ok") setData(res.data);
    // A superseded read must not end the load either — the read that replaced
    // it owns the spinner now.
    setLoading(false);
  }, [windowDays]);

  useEffect(() => {
    setLoading(true);
    void refetch();
    // Unmounting, or a window change, retires whatever is in flight.
    return () => {
      generation.current += 1;
    };
  }, [refetch]);

  useEffect(() => {
    if (!isTauri) return;
    const unlisten = listen("scan-done", () => void refetch());
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [refetch]);

  return { data, loading };
}
