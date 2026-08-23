import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { commands, isTauri, type RuleInfo } from "@/lib/ipc";
import { DELETE_FAILED, IMPORT_FAILED, TOGGLE_FAILED } from "./Rules.constants";
import type { RulesState } from "./Rules.types";

/**
 * The rule set the screen tables: fetches it, toggles rules, deletes custom
 * ones and imports packs.
 *
 * Creating rules deliberately isn't here — that lives on `/rules/new` (spec
 * §4.3), so this hook stays the read/maintain surface and the composer state
 * doesn't leak into a screen that no longer composes anything.
 *
 * **None of the actions below reject.** Each one owns its failure: it puts the
 * optimistic change back and writes a sentence into `error`. That is what lets
 * the screen fire them without a rejection handler at every call site, and it
 * is the only way an optimistic UI can be honest — a switch that springs back
 * with no explanation reads as a broken switch, not as a write that failed.
 */
export function useRules(): RulesState {
  const [rules, setRules] = useState<RuleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiReady, setAiReady] = useState(false);

  const refetch = useCallback(async () => {
    if (!isTauri) {
      setLoading(false);
      return;
    }
    try {
      const res = await commands.listRules();
      if (res.status === "ok") {
        setRules(res.data);
        setFailed(false);
      } else {
        setFailed(true);
      }
    } catch {
      // A rejected invoke is the same outcome as an error result, and the
      // screen has to say so: the app ships with rules, so an empty table
      // would be a claim that is never true.
      setFailed(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Natural-language standards need a provider and a key to run at all; the
  // AI tab says which of the two states it is in. Entitlement is deliberately
  // not read: monetisation is paused, so a licence must not decide anything
  // this screen shows.
  useEffect(() => {
    if (!isTauri) return;
    void (async () => {
      const cfg = await commands.getAiConfig();
      if (cfg.status === "ok") setAiReady(cfg.data.provider !== "none" && cfg.data.has_key);
    })();
  }, []);

  const toggle = useCallback(async (id: string, enabled: boolean) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
    try {
      const res = await commands.setRule(id, enabled);
      if (res.status !== "ok") throw new Error(res.error);
      setError(null);
    } catch {
      // `!enabled` is where the switch was a moment ago — this is the exact
      // inverse of the optimistic write above, not a guess at the truth.
      setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !enabled } : r)));
      setError(TOGGLE_FAILED);
    }
  }, []);

  const deleteRule = useCallback(
    async (id: string) => {
      setRules((prev) => prev.filter((r) => r.id !== id));
      try {
        const res = await commands.deleteCustomRule(id);
        if (res.status !== "ok") throw new Error(res.error);
        setError(null);
      } catch {
        // Refetched rather than spliced back at its old index: the delete may
        // have half-happened, and the server's list is the only version of the
        // truth worth putting back on screen. Refetching also keeps this
        // callback off `rules` — a dependency on the row set would change its
        // identity on every fetch and blow the column cache the screen builds
        // on top of it.
        await refetch();
        setError(DELETE_FAILED);
      }
    },
    [refetch],
  );

  const importPack = useCallback(async (): Promise<number> => {
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: "JSON pack", extensions: ["json"] }],
      });
      // Dismissing the picker is not a failure; it is the user changing their
      // mind, and it must not put an error on screen.
      if (typeof path !== "string") return 0;
      const res = await commands.importPack(path);
      if (res.status !== "ok") throw new Error(res.error);
      setError(null);
      await refetch();
      return res.data;
    } catch {
      setError(IMPORT_FAILED);
      return 0;
    }
  }, [refetch]);

  return { rules, loading, failed, error, aiReady, toggle, deleteRule, importPack, refetch };
}
