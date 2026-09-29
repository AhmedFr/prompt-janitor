import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, isTauri, type FileRow, type SetupView } from "@/lib/ipc";
import type { SetupState } from "./Setup.types";

/**
 * Loads the whole setup inventory and every graded file together, and
 * refetches both whenever a scan finishes. Everything the screen shows is a
 * slice of those two — the table filters them client-side, so there is
 * nothing to memoise per project.
 */
export function useSetup(): SetupState {
  const [data, setData] = useState<SetupView | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!isTauri) {
      setLoading(false);
      return;
    }
    try {
      // The graded files are an addition, not a requirement: a failed file
      // query leaves the inventory standing, with no graded-only rows.
      const [res, graded] = await Promise.all([
        commands.getSetup(),
        commands.listFiles().catch(() => null),
      ]);
      if (res.status === "ok") setData(res.data);
      setFiles(graded?.status === "ok" ? graded.data : []);
    } catch {
      // Surfaced by the screen as the unreadable state; nothing to add here.
    } finally {
      // A failed query still ends the load: leaving the spinner up forever
      // reads as a hang rather than an error.
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (!isTauri) return;
    const unlisten = listen("scan-done", () => {
      void refetch();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [refetch]);

  return { data, files, loading, refetch };
}
