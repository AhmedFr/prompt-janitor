import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { PROJECT_EVENTS } from "@/lib/project-events";
import { commands, isTauri, type ProjectRow, type FileRow, type ProjectUsage, type SetupView } from "@/lib/ipc";
import type { ProjectsState } from "./Projects.types";
import { lensHarnessFor, sessionsByProject, trim } from "./projects.util";

const EMPTY_USAGE = { ranked: [], sessions_per_day: [] } satisfies ProjectUsage;

/**
 * Every scanned project in one round trip, refetched whenever a scan finishes
 * or the project set changes outside one — removing a scan folder drops its
 * projects before any rescan runs.
 */
export function useProjects(): ProjectsState {
  const [data, setData] = useState<ProjectRow[] | null>(null);
  const [setup, setSetup] = useState<SetupView | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [usage, setUsage] = useState<Map<string, ProjectUsage | null> | null>(null);
  const [sessions90, setSessions90] = useState<Map<string, number> | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!isTauri) {
      setLoading(false);
      return;
    }
    try {
      // Only the project list decides between a table and the failure panel;
      // every other query degrades to `null`, which the columns show as "—".
      const [res, setupRes, usageRes, filesRes] = await Promise.all([
        commands.listProjects(),
        Promise.resolve(commands.getSetup()).catch(() => null),
        Promise.resolve(commands.getUsageOverview(90)).catch(() => null),
        Promise.resolve(commands.listFiles()).catch(() => null),
      ]);
      if (res.status === "ok") setData(res.data);
      const inventory = setupRes?.status === "ok" ? setupRes.data : null;
      setSetup(inventory);
      setFiles(filesRes?.status === "ok" ? filesRes.data : []);
      setSessions90(usageRes?.status === "ok" ? sessionsByProject(usageRes.data.sessions_per_project) : null);
      // A project's lens counts against its own sessions, so each needs its own usage.
      if (res.status === "ok" && inventory) {
        const fallback = inventory.harnesses.find((h) => h.detected)?.id ?? "";
        const entries = await Promise.all(
          res.data.map(async (row): Promise<[string, ProjectUsage | null]> => {
            const harness = lensHarnessFor(row, fallback);
            // No harness has worked here: an empty usage is the true answer, not a failure.
            if (!harness) return [trim(row.id), EMPTY_USAGE];
            try {
              const u = await commands.getProjectUsage(harness, row.id, 90);
              return [trim(row.id), u.status === "ok" ? u.data : null];
            } catch {
              return [trim(row.id), null];
            }
          }),
        );
        setUsage(new Map(entries));
      } else {
        setUsage(null);
      }
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

  return { data, setup, files, usage, sessions90, loading, refetch };
}
