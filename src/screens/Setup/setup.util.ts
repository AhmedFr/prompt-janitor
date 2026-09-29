import type { HarnessInfo, ProjectSetup } from "@/lib/ipc";
import type { SetupFilter } from "@/lib/setupFilter";

export type { SetupFilter };

/**
 * Orders projects the way the user thinks about them: the ones still on disk
 * first, most recently worked in first within that, and projects that never had
 * a session last.
 */
export function sortProjects(projects: ProjectSetup[]): ProjectSetup[] {
  return [...projects].sort((a, b) => {
    if (a.exists !== b.exists) return a.exists ? -1 : 1;
    if (a.last_session_at === b.last_session_at) return 0;
    if (a.last_session_at == null) return 1;
    if (b.last_session_at == null) return -1;
    // ISO-8601 timestamps sort lexicographically; newest first.
    return a.last_session_at < b.last_session_at ? 1 : -1;
  });
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const MONTH_DAYS = 30;

/**
 * Coarse relative age of an ISO-8601 timestamp — the harness records sessions
 * in ISO, unlike the epoch-seconds mtimes `relativeTime` formats.
 */
export function relativeSession(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "never";
  const ms = now.getTime() - then;
  if (ms < HOUR_MS) return "just now";
  if (ms < DAY_MS) return `${Math.floor(ms / HOUR_MS)}h ago`;
  const days = Math.floor(ms / DAY_MS);
  if (days < MONTH_DAYS) return `${days}d ago`;
  return `${Math.floor(days / MONTH_DAYS)}mo ago`;
}

/**
 * "1 project" / "3 projects" / "1,204 sessions" — the count and its noun,
 * agreed in number. Grouped, because these counts run into the thousands on
 * a real machine and "1204 sessions" is read digit by digit.
 */
export const plural = (n: number, word: string) =>
  `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

/** The one-line summary chip for a detected harness. */
export function harnessSummary(harness: HarnessInfo): string {
  return [
    harness.display_name,
    plural(harness.project_count, "project"),
    plural(harness.session_count, "session"),
  ].join(" · ");
}

/** "12 sessions" / "1 session" — the session count as it reads in a project row. */
export function sessionLabel(count: number): string {
  return plural(count, "session");
}

/**
 * The grade of the project's first graded rule — the closest single answer to
 * "how well is this project set up?" that fits in a collapsed row.
 */
export function topRuleGrade(project: ProjectSetup): string | null {
  return project.artifacts.find((a) => a.kind === "rule" && a.grade)?.grade ?? null;
}

/**
 * The project (root path, display name) a project-layer artifact's path
 * falls under, by longest matching path prefix. `ArtifactView` carries no
 * project reference of its own — only the file's absolute path — so the
 * lookup works backwards from `projectNames`' keys (project root paths).
 * `null` for anything not under a known project: global/plugin-layer rows,
 * or a project the caller didn't pass in. Longest-prefix wins so a nested
 * project (rare, but not impossible) resolves to its own root rather than
 * its parent's.
 */
export function matchProject(
  path: string,
  projectNames: Map<string, string>,
): { path: string; name: string } | null {
  let best: { path: string; name: string } | null = null;
  for (const [projectPath, name] of projectNames) {
    if (path !== projectPath && !path.startsWith(`${projectPath}/`)) continue;
    if (!best || projectPath.length > best.path.length) best = { path: projectPath, name };
  }
  return best;
}

/** Convenience wrapper over {@link matchProject} for callers that only need the name (`ScopeCell`). */
export function projectNameFor(path: string, projectNames: Map<string, string>): string | null {
  return matchProject(path, projectNames)?.name ?? null;
}

/** Project root path -> display name, the lookup `ScopeCell` and the Scope pills resolve against. */
export function projectNameMap(projects: ProjectSetup[]): Map<string, string> {
  return new Map(projects.map((p) => [p.path, p.name]));
}

/**
 * The most recent scan across the detected harnesses — the one number the
 * header can honestly show when more than one harness is installed. `null`
 * when nothing has been scanned yet, which {@link relativeSession} reads as
 * "never".
 */
export function lastScanAt(harnesses: HarnessInfo[]): string | null {
  // ISO-8601 timestamps compare lexicographically.
  return harnesses.reduce<string | null>(
    (best, h) => (h.last_scan_at != null && (best == null || h.last_scan_at > best) ? h.last_scan_at : best),
    null,
  );
}
