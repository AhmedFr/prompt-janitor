import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { PROJECT_EVENTS } from "@/lib/project-events";
import { commands, isTauri, type ProjectRow, type SetupView } from "@/lib/ipc";
import type { ProjectsState } from "./Projects.types";
import { sessionsByProject } from "./projects.util";

/**
 * Every scanned project in one round trip, refetched whenever a scan finishes
 * or the project set changes outside one — removing a scan folder drops its
 * projects before any rescan runs.
 */
export function useProjects(): ProjectsState {
  const [data, setData] = useState<ProjectRow[] | null>(null);
  const [setup, setSetup] = useState<SetupView | null>(null);
  const [sessions90, setSessions90] = useState<Map<string, number> | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!isTauri) {
      setLoading(false);
      return;
    }
    try {
      // The extra columns degrade to blanks on their own failure; only the
      // project list decides between a table and the failure panel.
      const [res, setupRes, usageRes] = await Promise.all([
        commands.listProjects(),
        Promise.resolve(commands.getSetup()).catch(() => null),
        Promise.resolve(commands.getUsageOverview(90)).catch(() => null),
      ]);
      if (res.status === "ok") setData(res.data);
      setSetup(setupRes?.status === "ok" ? setupRes.data : null);
      setSessions90(usageRes?.status === "ok" ? sessionsByProject(usageRes.data.sessions_per_project) : null);
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

  return { data, setup, sessions90, loading, refetch };
}
