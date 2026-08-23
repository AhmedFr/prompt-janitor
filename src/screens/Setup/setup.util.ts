import type {
  ArtifactKind,
  ArtifactView,
  HarnessInfo,
  ProjectSetup,
  SetupView,
} from "@/lib/ipc";
import {
  COST_MEDIAN_MULTIPLIER,
  ERROR_RATE_THRESHOLD,
  KIND_ORDER,
  MIN_COST_SAMPLES,
} from "./Setup.constants";

/** Which slice of the inventory the screen is showing. */
export type SetupFilter = "all" | "never" | "errors" | "cost";

/** Middle value of a sorted-ascending copy; the mean of the middle pair when even. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * What an artifact has to burn per turn to count as expensive: twice what the
 * typical measured artifact burns. `null` when fewer than
 * {@link MIN_COST_SAMPLES} artifacts have been measured — there is no typical
 * cost yet, and inventing one would flag arbitrary rows.
 *
 * Compute this once over the whole setup. Per-section medians would re-normalise
 * every list to itself, so a section holding only expensive things would report
 * half of them as cheap.
 */
export function costThreshold(artifacts: ArtifactView[]): number | null {
  const costs = artifacts
    .map((a) => a.usage?.avg_turn_tokens)
    .filter((t): t is number => t != null);
  if (costs.length < MIN_COST_SAMPLES) return null;
  return median(costs) * COST_MEDIAN_MULTIPLIER;
}

/**
 * Narrows the inventory to the slice the user asked for. Pass `threshold` — the
 * {@link costThreshold} of the whole setup — so `cost` means the same thing in
 * every section; omit it and the bar is computed from `artifacts` alone.
 */
export function applyFilter(
  artifacts: ArtifactView[],
  filter: SetupFilter,
  threshold?: number | null,
): ArtifactView[] {
  if (filter === "all") return artifacts;
  if (filter === "never") return artifacts.filter((a) => a.usage == null);
  if (filter === "errors") {
    return artifacts.filter((a) => (a.usage?.error_rate ?? 0) >= ERROR_RATE_THRESHOLD);
  }

  const bar = threshold === undefined ? costThreshold(artifacts) : threshold;
  if (bar == null) return [];
  return artifacts.filter((a) => {
    const cost = a.usage?.avg_turn_tokens;
    return cost != null && cost >= bar;
  });
}

/**
 * The size of every filter's slice, so the chips can say what they would
 * narrow to before the user commits a click. Pass the whole inventory —
 * global plus every project's artifacts — and the shared cost bar.
 */
export function filterCounts(
  artifacts: ArtifactView[],
  costBar: number | null,
): Record<SetupFilter, number> {
  return {
    all: artifacts.length,
    never: applyFilter(artifacts, "never", costBar).length,
    errors: applyFilter(artifacts, "errors", costBar).length,
    cost: applyFilter(artifacts, "cost", costBar).length,
  };
}

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

/**
 * The whole inventory as one list: the global layer (which is where
 * plugin-installed artifacts land too — they have no project of their own)
 * followed by every project's artifacts. This is the set every Setup table
 * is a kind-filtered slice of, and the set the shared cost bar is measured
 * over.
 */
export function allArtifacts(view: SetupView): ArtifactView[] {
  return [...view.global, ...view.projects.flatMap((p) => p.artifacts)];
}

/**
 * The inventory bucketed per kind, in one pass, with an entry for *every*
 * kind — a tab whose kind nothing landed in still has to render (with a
 * count of zero), unlike the old screen's sections which were dropped when
 * empty. Order within a bucket is the order the inventory arrived in, which
 * the backend already sorts by kind then name.
 */
export function rowsByKind(artifacts: ArtifactView[]): Map<ArtifactKind, ArtifactView[]> {
  const out = new Map<ArtifactKind, ArtifactView[]>(KIND_ORDER.map((kind) => [kind, []]));
  for (const artifact of artifacts) {
    // A kind outside `KIND_ORDER` cannot exist in the generated bindings, but
    // a stale database row could still carry one; give it a bucket rather
    // than dropping it on the floor.
    const bucket = out.get(artifact.kind);
    if (bucket) bucket.push(artifact);
    else out.set(artifact.kind, [artifact]);
  }
  return out;
}

/** Project root path -> display name, the lookup `ScopeCell` and the Scope pills resolve against. */
export function projectNameMap(projects: ProjectSetup[]): Map<string, string> {
  return new Map(projects.map((p) => [p.path, p.name]));
}

/**
 * Plugin name -> how many artifacts that install bundled: the skills, agents
 * and commands the harness scanned out of the plugin's own subtrees. The
 * plugin's manifest row carries its own `plugin_name` too (the scanner gives
 * every artifact under an install the same context), so `kind === "plugin"`
 * is excluded — otherwise every plugin would report one more than it ships.
 * `layer === "plugin"` is required as well: a project file that merely names
 * a plugin was not installed by it.
 *
 * Computed over the whole inventory rather than over the Plugins tab's rows,
 * which by definition hold nothing but plugin manifests — see `ColumnsCtx`.
 */
export function pluginBundleCounts(artifacts: ArtifactView[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const artifact of artifacts) {
    if (artifact.kind === "plugin" || artifact.layer !== "plugin") continue;
    const plugin = artifact.plugin_name;
    if (!plugin) continue;
    out.set(plugin, (out.get(plugin) ?? 0) + 1);
  }
  return out;
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
