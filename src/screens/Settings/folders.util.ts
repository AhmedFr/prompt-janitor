import type { ProjectRow } from "@/lib/ipc";

/** `child` is `parent` or sits somewhere under it, compared on whole path segments. */
function isInside(child: string, parent: string): boolean {
  const p = parent.replace(/\/+$/, "");
  return child === p || child.startsWith(p + "/");
}

/**
 * How many projects removing `folder` deletes — the same rule
 * `replace_extra_folders` (src-tauri/src/scan_folders.rs) applies: a project
 * inside the folder goes unless a remaining folder covers it in either
 * direction (`inside(root, c) || inside(c, root)`) or a harness still works
 * in it.
 */
export function projectsRemovedBy(folder: string, remaining: string[], projects: ProjectRow[]): number {
  return projects.filter(
    (p) =>
      isInside(p.id, folder) &&
      p.harness === null &&
      !remaining.some((r) => isInside(p.id, r) || isInside(r, p.id)),
  ).length;
}

/** The confirmation line (spec §16), exact; singular for one project. Only asked when n ≥ 1. */
export function removalWarning(n: number): string {
  const what = n === 1 ? "1 project and its history" : `${n} projects and their history`;
  return `Removes ${what} from Prompt Janitor. Files on disk are not touched.`;
}
