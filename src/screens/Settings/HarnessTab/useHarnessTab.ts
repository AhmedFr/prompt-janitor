import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, isTauri, type HarnessInfo } from "@/lib/ipc";
import { addFolderAndScan, removeExtraFolder, rescan as rescanNow } from "@/lib/scan-actions";
import { useScanProgress } from "@/lib/useScanProgress";
import type { UseHarnessTab } from "./HarnessTab.types";

/**
 * Loads the registered harnesses and the extra scan folders for Settings →
 * Harnesses, and wires up add/remove/rescan — refetching whenever a scan
 * finishes, the same way Setup's inventory does.
 */
export function useHarnessTab(): UseHarnessTab {
  const [harnesses, setHarnesses] = useState<HarnessInfo[]>([]);
  const [extraFolders, setExtraFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const scanProgress = useScanProgress();

  const refetch = useCallback(async () => {
    if (!isTauri) {
      setLoading(false);
      return;
    }
    const [h, f] = await Promise.all([commands.listHarnesses(), commands.getExtraScanFolders()]);
    if (h.status === "ok") setHarnesses(h.data);
    if (f.status === "ok") setExtraFolders(f.data);
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

  // Wraps a scan action with the busy flag and a fresh progress bar — the
  // same shape Setup's Rescan button uses, so the two never drift apart.
  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      scanProgress.reset();
      setScanning(true);
      try {
        await action();
      } finally {
        setScanning(false);
      }
    },
    [scanProgress],
  );

  const addFolder = useCallback(() => run(addFolderAndScan), [run]);
  const rescan = useCallback(() => run(rescanNow), [run]);

  const removeFolder = useCallback(
    async (path: string) => {
      setExtraFolders(await removeExtraFolder(path));
      await run(rescanNow);
    },
    [run],
  );

  return {
    harnesses,
    extraFolders,
    loading,
    scanning,
    scanProgress,
    addFolder,
    removeFolder,
    rescan,
  };
}
