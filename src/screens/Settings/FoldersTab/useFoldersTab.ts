import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, isTauri, type HarnessInfo, type ProjectRow } from "@/lib/ipc";
import { addFolderAndScan, removeExtraFolder, rescan as rescanNow } from "@/lib/scan-actions";
import { useScanProgress } from "@/lib/useScanProgress";
import { projectsRemovedBy } from "../folders.util";
import type { UseFoldersTab } from "./FoldersTab.types";

/**
 * Loads the registered harnesses, the extra scan folders and the project
 * list for Settings → Folders, and wires up add/remove/rescan — refetching
 * whenever a scan finishes, the same way Setup's inventory does.
 */
export function useFoldersTab(): UseFoldersTab {
  const [harnesses, setHarnesses] = useState<HarnessInfo[]>([]);
  const [extraFolders, setExtraFolders] = useState<string[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [armed, setArmed] = useState<string | null>(null);
  const scanProgress = useScanProgress();

  const refetch = useCallback(async () => {
    if (!isTauri) {
      setLoading(false);
      return;
    }
    const [h, f, p] = await Promise.all([
      commands.listHarnesses(),
      commands.getExtraScanFolders(),
      commands.listProjects(),
    ]);
    if (h.status === "ok") setHarnesses(h.data);
    if (f.status === "ok") setExtraFolders(f.data);
    if (p.status === "ok") setProjects(p.data);
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

  // Nothing to lose, nothing to confirm: a removal that deletes no project happens at once.
  const askRemove = useCallback(
    (path: string) => {
      const n = projectsRemovedBy(
        path,
        extraFolders.filter((x) => x !== path),
        projects,
      );
      if (n === 0) void removeFolder(path);
      else setArmed(path);
    },
    [extraFolders, projects, removeFolder],
  );

  const cancelRemove = useCallback(() => setArmed(null), []);

  const confirmRemove = useCallback(async () => {
    if (!armed) return;
    const path = armed;
    setArmed(null);
    await removeFolder(path);
  }, [armed, removeFolder]);

  return {
    harnesses,
    extraFolders,
    projects,
    loading,
    scanning,
    scanProgress,
    armed,
    addFolder,
    askRemove,
    cancelRemove,
    confirmRemove,
    rescan,
  };
}
