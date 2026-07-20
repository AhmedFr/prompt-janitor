import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, isTauri } from "@/lib/ipc";
import { RECENT_PROJECTS_LIMIT } from "./Sidebar.constants";
import type { NavCounts, SidebarProject } from "./Sidebar.types";

/**
 * Loads the sidebar's live data — the recent-projects list and the nav badge
 * counts — and refetches whenever a scan finishes. Outside Tauri (tests,
 * Storybook) it stays empty so the shell still renders.
 */
export function useSidebar() {
  const [projects, setProjects] = useState<SidebarProject[]>([]);
  const [counts, setCounts] = useState<NavCounts>({});

  const refetch = useCallback(async () => {
    if (!isTauri) return;
    const [projectsRes, files, rules] = await Promise.all([
      commands.listProjects(),
      commands.listFiles(),
      commands.listRules(),
    ]);
    if (projectsRes.status === "ok") {
      setProjects(
        projectsRes.data.slice(0, RECENT_PROJECTS_LIMIT).map((p) => ({
          id: p.id,
          name: p.name,
          grade: p.grade,
          logo: p.logo,
          modified: p.modified,
        })),
      );
    }
    if (files.status === "ok") setCounts((prev) => ({ ...prev, prompts: files.data.length }));
    if (rules.status === "ok") setCounts((prev) => ({ ...prev, rules: rules.data.length }));
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

  return { projects, counts };
}
