import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, isTauri, type FileRow, type Overview } from "@/lib/ipc";

/** Fetches the Overview payload and file list, refetching whenever a scan finishes. */
export function useOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!isTauri) {
      setLoading(false);
      return;
    }
    const [overviewRes, filesRes] = await Promise.all([commands.getOverview(), commands.listFiles()]);
    if (overviewRes.status === "ok") setData(overviewRes.data);
    if (filesRes.status === "ok") setFiles(filesRes.data);
    setLoading(false);
  }, []);

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

  return { data, files, loading, refetch };
}
