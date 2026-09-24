import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { PROJECT_EVENTS } from "@/lib/project-events";
import { commands, isTauri, type ProjectRow } from "@/lib/ipc";
import type { ProjectsState } from "./Projects.types";

/**
 * Every scanned project in one round trip, refetched whenever a scan finishes
 * or the project set changes outside one — removing a scan folder drops its
 * projects before any rescan runs.
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
    const unlisteners = PROJECT_EVENTS.map((event) => listen(event, () => void refetch()));
    return () => {
      for (const unlisten of unlisteners) void unlisten.then((fn) => fn());
    };
  }, [refetch]);

  return { data, loading, refetch };
}
