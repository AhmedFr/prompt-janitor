import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, isTauri, type EffectiveRule, type SetupView } from "@/lib/ipc";
import type { SetupState } from "./Setup.types";
import type { SetupFilter } from "./setup.util";

/** Cache key for one project's rule stack. A space cannot start a harness id. */
const rulesKey = (harness: string, projectPath: string) => `${harness} ${projectPath}`;

/**
 * Loads the whole setup inventory in one round trip, refetching whenever a scan
 * finishes, and lends out each project's effective rule stack on demand — that
 * second query is per-project and only worth paying for once a project is
 * actually expanded.
 */
export function useSetup(initialFilter: SetupFilter = "all"): SetupState {
  const [data, setData] = useState<SetupView | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SetupFilter>(initialFilter);
  const rules = useRef(new Map<string, Promise<EffectiveRule[]>>());

  const refetch = useCallback(async () => {
    if (!isTauri) {
      setLoading(false);
      return;
    }
    const res = await commands.getSetup();
    if (res.status === "ok") setData(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (!isTauri) return;
    const unlisten = listen("scan-done", () => {
      // A scan can change the stack; drop the memoised answers with the data.
      rules.current.clear();
      void refetch();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [refetch]);

  const effectiveRulesFor = useCallback((harness: string, projectPath: string) => {
    const key = rulesKey(harness, projectPath);
    const cached = rules.current.get(key);
    if (cached) return cached;
    const pending = (async () => {
      if (!isTauri) return [];
      const res = await commands.getEffectiveRules(harness, projectPath);
      return res.status === "ok" ? res.data : [];
    })();
    rules.current.set(key, pending);
    return pending;
  }, []);

  return { data, loading, filter, setFilter, refetch, effectiveRulesFor };
}
