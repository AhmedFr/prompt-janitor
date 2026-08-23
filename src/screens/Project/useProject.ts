import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, isTauri, type EffectiveRule, type ProjectUsage } from "@/lib/ipc";
import { USAGE_WINDOW_DAYS } from "./Project.constants";
import { filesFor, projectLastScan } from "./project.util";
import type { ProjectData, ProjectState } from "./Project.types";

/** `{ status: "ok", data }` or nothing — a failed command reads as absent, not as empty. */
function unwrap<T>(res: { status: "ok"; data: T } | { status: "error"; error: unknown }): T | null {
  return res.status === "ok" ? res.data : null;
}

/**
 * Everything one project's page renders, assembled from the reads that
 * already exist: the project rollup, the file list, the setup inventory and
 * — only when a harness has actually worked here — that harness's load order
 * and usage.
 *
 * The three project-wide reads run together and fail together: a page that
 * showed a header from one query and an empty table from a failed second one
 * would be telling the reader something false about their project. A failure
 * leaves `data` null, which the screen renders as a failure rather than as an
 * empty project. The two harness reads are separate on purpose — they are
 * scoped to a harness, and a project without one is a normal state, not an
 * error.
 *
 * Refetched on `scan-done`: a scan is the only thing that can change a grade,
 * add a file, or notice that a folder is gone.
 *
 * Every write is gated on a generation counter, because these reads outlive
 * the project they were started for. Opening one project from the sidebar
 * recents and immediately opening another leaves the first read in flight;
 * without the gate it lands last and wins, painting the previous project's
 * rows under the current project's name — or, if it fails, flashing the
 * failure panel over a page that loaded perfectly well.
 */
export function useProject(path: string | undefined): ProjectState {
  const [data, setData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  // Bumped whenever a read is started or superseded; a read may only write
  // while the counter still holds the value it claimed on entry.
  const generation = useRef(0);

  const refetch = useCallback(async () => {
    const mine = ++generation.current;
    const fresh = () => generation.current === mine;

    if (!isTauri || path === undefined) {
      setLoading(false);
      return;
    }
    try {
      const [projects, files, setup] = await Promise.all([
        commands.listProjects(),
        commands.listFiles(),
        commands.getSetup(),
      ]);
      const rows = unwrap(projects);
      const allFiles = unwrap(files);
      const setupView = unwrap(setup);
      // One read answering and another not is not "this project is empty":
      // it is a page that cannot be honestly drawn, so all three fail
      // together. (TypeScript enforces the null checks below; this is the
      // runtime half of the same contract.)
      if (!rows || !allFiles || !setupView) {
        if (fresh()) setData(null);
        return;
      }

      const project = rows.find((row) => row.id === path) ?? null;
      const harness = project?.harness ?? null;

      // Nothing to ask a harness that does not exist: `get_effective_rules`
      // and `get_project_usage` are both keyed by one, so without it the two
      // tabs say why they are empty instead of showing an empty answer.
      let effective: EffectiveRule[] = [];
      let usage: ProjectUsage | null = null;
      if (harness) {
        const [rules, used] = await Promise.all([
          commands.getEffectiveRules(harness, path),
          commands.getProjectUsage(harness, path, USAGE_WINDOW_DAYS),
        ]);
        effective = unwrap(rules) ?? [];
        usage = unwrap(used);
      }

      if (!fresh()) return;
      setData({
        project,
        files: filesFor(allFiles, path),
        setup: setupView.projects.find((p) => p.path === path) ?? null,
        effective,
        usage,
        lastScanAt: projectLastScan(setupView.harnesses, harness),
        harness,
        harnessName: setupView.harnesses.find((h) => h.id === harness)?.display_name ?? null,
      });
    } catch {
      // Surfaced by the screen as the unreadable state; nothing to add here.
      if (fresh()) setData(null);
    } finally {
      // A failed query still ends the load: leaving the spinner up forever
      // reads as a hang rather than an error. A superseded read must not do
      // it, though — the read that replaced it owns the spinner now.
      if (fresh()) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    // A different project is a different page: drop the last one's data
    // rather than painting it under the new project's name for a frame, and
    // retire whatever the previous project left in flight before the new
    // read even starts.
    generation.current += 1;
    setData(null);
    setLoading(true);
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (!isTauri || path === undefined) return;
    const unlisten = listen("scan-done", () => {
      void refetch();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [refetch, path]);

  return { data, loading, refetch };
}
