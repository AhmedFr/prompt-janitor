import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, isTauri, type SetupView } from "@/lib/ipc";
import type { EffectiveRules } from "./ProjectRow";
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
  const rules = useRef(new Map<string, Promise<EffectiveRules>>());
  // Bumped alongside every cache clear so open projects know to ask again.
  const [rulesVersion, setRulesVersion] = useState(0);

  const refetch = useCallback(async () => {
    if (!isTauri) {
      setLoading(false);
      return;
    }
    try {
      const res = await commands.getSetup();
      if (res.status === "ok") setData(res.data);
    } catch {
      // Surfaced by the screen as the unreadable state; nothing to add here.
    } finally {
      // A failed query still ends the load: leaving the spinner up forever
      // reads as a hang rather than an error.
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (!isTauri) return;
    const unlisten = listen("scan-done", () => {
      // A scan can change the stack; drop the memoised answers with the data.
      rules.current.clear();
      setRulesVersion((n) => n + 1);
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
    const pending = (async (): Promise<EffectiveRules> => {
      if (!isTauri) return [];
      const res = await commands.getEffectiveRules(harness, projectPath);
      // A failed query is not an empty stack. Reporting it as `[]` would tell
      // the user no rule file applies to a project that may be full of them.
      return res.status === "ok" ? res.data : "error";
    })()
      .catch((): EffectiveRules => "error")
      .then((result) => {
        // Never memoise a failure — the next attempt should be a real one.
        if (result === "error") rules.current.delete(key);
        return result;
      });
    rules.current.set(key, pending);
    return pending;
  }, []);

  return { data, loading, filter, setFilter, refetch, effectiveRulesFor, rulesVersion };
}
