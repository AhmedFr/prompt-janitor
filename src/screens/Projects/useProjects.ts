import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, isTauri, type ProjectRow } from "@/lib/ipc";
import type { ProjectsState } from "./Projects.types";

/**
 * Every scanned project in one round trip, refetched whenever a scan finishes
 * — a scan is the only thing that can add a project, change a grade or notice
 * that a folder is gone.
 */
export function useProjects(): ProjectsState {
  const [data, setData] = useState<ProjectRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!isTauri) {
      setLoading(false);
      return;
    }
    try {
      const res = await commands.listProjects();
      if (res.status === "ok") setData(res.data);
    } catch {
      // Surfaced by the screen as an empty table; nothing to add here.
    } finally {
      // A failed query still ends the load: leaving the skeleton up forever
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

  return { data, loading, refetch };
}
