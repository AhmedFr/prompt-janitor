import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, isTauri, type FileRow } from "@/lib/ipc";
import { gradeForScore, overallFromFileScores } from "@/lib/scoring";
import { RECENT_PROJECTS_LIMIT } from "./Sidebar.constants";
import type { NavCounts, SidebarProject } from "./Sidebar.types";

/** Newer mtimes sort first; files without one sink to the bottom. */
function byModifiedDesc(a: string | null, b: string | null): number {
  return Number(b ?? 0) - Number(a ?? 0);
}

/** Roll the flat file list up into per-project cards (grade = average score). */
function toProjects(files: FileRow[]): SidebarProject[] {
  const groups = new Map<string, FileRow[]>();
  for (const file of files) {
    const bucket = groups.get(file.project);
    if (bucket) bucket.push(file);
    else groups.set(file.project, [file]);
  }

  const projects: SidebarProject[] = [];
  for (const [name, rows] of groups) {
    const modified = rows.reduce<string | null>(
      (latest, row) => (byModifiedDesc(row.modified, latest) < 0 ? row.modified : latest),
      null,
    );
    projects.push({
      name,
      grade: gradeForScore(overallFromFileScores(rows.map((r) => r.score))),
      modified,
    });
  }

  return projects
    .sort((a, b) => byModifiedDesc(a.modified, b.modified))
    .slice(0, RECENT_PROJECTS_LIMIT);
}

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
    const [files, rules] = await Promise.all([commands.listFiles(), commands.listRules()]);
    if (files.status === "ok") {
      setProjects(toProjects(files.data));
      setCounts((prev) => ({ ...prev, prompts: files.data.length }));
    }
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
