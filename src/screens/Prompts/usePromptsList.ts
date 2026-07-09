import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, isTauri, type FileRow, type ProjectRow } from "@/lib/ipc";
import type { ProjectGroup, PromptFilters } from "./Prompts.types";

const GRADE_RANK: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, F: 4 };

/** Pure grouping/filter/sort so it can be unit-tested without Tauri. */
export function buildGroups(
  files: FileRow[],
  projects: ProjectRow[],
  filters: PromptFilters,
): ProjectGroup[] {
  const q = filters.search.trim().toLowerCase();
  const matches = (f: FileRow) => {
    if (filters.tab === "flagged" && f.issue_count === 0) return false;
    if (filters.provider && f.kind !== filters.provider) return false;
    if (filters.grade && f.grade !== filters.grade) return false;
    if (q && !(`${f.name} ${f.path} ${f.project}`.toLowerCase().includes(q))) return false;
    return true;
  };

  const byProject = new Map<string, FileRow[]>();
  for (const f of files) {
    if (!matches(f)) continue;
    const bucket = byProject.get(f.project_id);
    if (bucket) bucket.push(f);
    else byProject.set(f.project_id, [f]);
  }

  const groups: ProjectGroup[] = projects
    .filter((p) => byProject.has(p.id))
    .map((p) => ({ project: p, files: byProject.get(p.id) ?? [] }));

  const cmp: Record<PromptFilters["sort"], (a: ProjectGroup, b: ProjectGroup) => number> = {
    grade: (a, b) => GRADE_RANK[b.project.grade] - GRADE_RANK[a.project.grade],
    issues: (a, b) => b.project.issue_count - a.project.issue_count,
    recent: (a, b) => Number(b.project.modified ?? 0) - Number(a.project.modified ?? 0),
  };
  return groups.sort(cmp[filters.sort]);
}

/** Loads files + project rollups and refetches after each scan. */
export function usePromptsList() {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!isTauri) {
      setLoading(false);
      return;
    }
    const [f, p] = await Promise.all([commands.listFiles(), commands.listProjects()]);
    if (f.status === "ok") setFiles(f.data);
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

  return { files, projects, loading, refetch };
}
