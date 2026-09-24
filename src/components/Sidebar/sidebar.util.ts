import type { ProjectRow } from "@/lib/ipc";
import type { SidebarProject } from "./Sidebar.types";

/** Parses to a millisecond timestamp, or 0 when absent or unreadable. */
function toMillis(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/**
 * When a project was last worked in, in milliseconds: the later of its last
 * harness session (ISO string) and its newest prompt file's mtime (epoch
 * seconds string). A session is the stronger signal — you can work in a
 * project for a week without touching its CLAUDE.md — but a project no
 * harness has recorded still has its files to go by. 0 when neither is known.
 */
export function lastActivity(row: ProjectRow): number {
  const session = row.last_session_at ? toMillis(Date.parse(row.last_session_at)) : 0;
  const modified = row.modified ? toMillis(Number(row.modified) * 1000) : 0;
  return Math.max(session, modified);
}

/**
 * The sidebar's "recent" shortcut list: the `limit` most recently active
 * projects that still exist on disk, newest first.
 *
 * It re-sorts rather than slicing `list_projects` as-is, because that command
 * orders best grade first for the Projects table — sliced, "recent" became
 * "the six healthiest" and never moved as you worked.
 */
export function recentProjects(rows: ProjectRow[], limit: number): SidebarProject[] {
  return rows
    .filter((row) => row.exists)
    .map((row) => ({ row, at: lastActivity(row) }))
    .sort((a, b) => b.at - a.at)
    .slice(0, limit)
    .map(({ row }) => ({ id: row.id, name: row.name, grade: row.grade, logo: row.logo }));
}
