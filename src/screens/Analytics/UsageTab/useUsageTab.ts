import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, isTauri, type UsageOverview } from "@/lib/ipc";

/**
 * Loads the harness usage overview for the Analytics → Usage tab over the last
 * `windowDays`, refetching when the toolbar's range changes and whenever a
 * scan finishes (the scan is what re-indexes the transcripts).
 */
export function useUsageTab(windowDays: number) {
  const [data, setData] = useState<UsageOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!isTauri) {
      setLoading(false);
      return;
    }
    const res = await commands.getUsageOverview(windowDays);
    if (res.status === "ok") setData(res.data);
    setLoading(false);
  }, [windowDays]);

  useEffect(() => {
    setLoading(true);
    void refetch();
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
