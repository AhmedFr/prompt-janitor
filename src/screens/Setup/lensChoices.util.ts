import type { ViewingSwitcherProject } from "@/components/ViewingSwitcher";
import type { FileRow, ProjectSetup } from "@/lib/ipc";

const trim = (p: string) => p.replace(/\/+$/, "");

/**
 * What the Viewing control offers: every inventory project, plus the lens
 * itself when it is a path only the grader knows (a deep link can name one) —
 * so the control always names the lens the table is showing.
 */
export function lensChoices(projects: ProjectSetup[], files: FileRow[], lens: string | null): ViewingSwitcherProject[] {
  const choices = projects.map((p) => ({ path: p.path, name: p.name, lastSessionAt: p.last_session_at }));
  if (lens === null || projects.some((p) => p.path === lens)) return choices;
  const here = trim(lens);
  const name = files.find((f) => trim(f.project_id) === here)?.project ?? here.split("/").pop() ?? here;
  return [...choices, { path: lens, name, lastSessionAt: null }];
}
