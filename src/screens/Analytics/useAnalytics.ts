import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, isTauri, type Analytics } from "@/lib/ipc";

/**
 * Loads the Analytics payload windowed to the trailing `rangeDays`,
 * refetching whenever a scan finishes or the caller switches ranges.
 */
export function useAnalytics(rangeDays: number) {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!isTauri) {
      setLoading(false);
      return;
    }
    const res = await commands.getAnalytics(rangeDays);
    if (res.status === "ok") setData(res.data);
    setLoading(false);
  }, [rangeDays]);

  useEffect(() => {
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
