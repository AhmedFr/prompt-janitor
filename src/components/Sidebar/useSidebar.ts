import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { PROJECT_EVENTS } from "@/lib/project-events";
import { commands, isTauri } from "@/lib/ipc";
import { RECENT_PROJECTS_LIMIT } from "./Sidebar.constants";
import type { NavCounts, SidebarProject } from "./Sidebar.types";
import { recentProjects } from "./sidebar.util";

/**
 * Loads the sidebar's live data — the recent-projects list and the nav badge
 * counts — and refetches whenever a scan finishes or the project set changes
 * without one (`projects-changed`). Outside Tauri (tests,
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
      setProjects(recentProjects(projectsRes.data, RECENT_PROJECTS_LIMIT));
    }
    if (files.status === "ok") setCounts((prev) => ({ ...prev, prompts: files.data.length }));
    if (rules.status === "ok") setCounts((prev) => ({ ...prev, rules: rules.data.length }));
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (!isTauri) return;
    // `projects-changed` covers what changes the project set without a scan
    // (removing a scan folder drops its projects straight away).
    const unlisteners = PROJECT_EVENTS.map((event) => listen(event, () => void refetch()));
    return () => {
      for (const unlisten of unlisteners) void unlisten.then((fn) => fn());
    };
  }, [refetch]);

  return { projects, counts };
}
