import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, isTauri, type EffectiveRule, type ProjectSetup, type ProjectUsage } from "@/lib/ipc";

import { LENS_WINDOW_DAYS } from "./lens.constants";

/**
 * What the lens needs beyond the inventory: the harness's load order for the
 * project, and its usage. A project no harness has worked in has neither —
 * that is a normal state, not an error.
 */
export function useLens(project: ProjectSetup | null) {
  const [effective, setEffective] = useState<EffectiveRule[] | null>(null);
  const [usage, setUsage] = useState<ProjectUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const generation = useRef(0);
  const harness = project?.harness ?? null;
  const path = project?.path ?? null;

  // `reset` is for a different project; a rescan keeps what is shown until the new data lands.
  const load = useCallback(
    async (reset: boolean) => {
      const mine = ++generation.current;
      if (reset || !harness || !path) {
        setEffective(null);
        setUsage(null);
      }
      setFailed(false);
      if (!isTauri || !harness || !path) return setLoading(false);
      setLoading(true);
      try {
        const [rules, used] = await Promise.all([
          commands.getEffectiveRules(harness, path),
          commands.getProjectUsage(harness, path, LENS_WINDOW_DAYS),
        ]);
        if (generation.current !== mine) return;
        setEffective(rules.status === "ok" ? rules.data : null);
        setUsage(used.status === "ok" ? used.data : null);
        setFailed(rules.status !== "ok" || used.status !== "ok");
      } catch {
        if (generation.current !== mine) return;
        setFailed(true);
      }
      setLoading(false);
    },
    [harness, path],
  );

  useEffect(() => void load(true), [load]);
  useEffect(() => {
    if (!isTauri) return;
    const off = listen("scan-done", () => void load(false));
    return () => void off.then((fn) => fn());
  }, [load]);

  return { effective, usage, loading, failed };
}
