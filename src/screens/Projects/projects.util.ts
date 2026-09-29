import type { ProjectSessions, SetupView } from "@/lib/ipc";

const trim = (path: string) => path.replace(/\/+$/, "");

/** Items Claude Code can use in the project: the global and plugin layers plus the project's own. */
export function itemsAvailable(projectPath: string, setup: SetupView | null): number | null {
  if (!setup) return null;
  const here = trim(projectPath);
  const own = setup.projects.find((p) => trim(p.path) === here)?.artifacts.length ?? 0;
  return setup.global.length + own;
}

/** Sessions started in the window, per project root (from `get_usage_overview`). */
export function sessionsByProject(rows: ProjectSessions[]): Map<string, number> {
  return new Map(rows.map((r) => [trim(r.path), r.sessions]));
}
