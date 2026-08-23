import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { commands, isTauri, type RuleInfo } from "@/lib/ipc";
import type { RulesState } from "./Rules.types";

/**
 * The rule set the screen tables: fetches it, toggles rules (optimistically
 * and persisted), deletes custom ones and imports packs.
 *
 * Creating rules deliberately isn't here — that lives on `/rules/new` (spec
 * §4.3), so this hook stays the read/maintain surface and the composer state
 * doesn't leak into a screen that no longer composes anything.
 */
export function useRules(): RulesState {
  const [rules, setRules] = useState<RuleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [entitled, setEntitled] = useState(false);

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
  // AI tab says which of the two states it is in. `entitled` is read but not
  // gated on anywhere in the UI — monetisation is paused, so a licence must
  // not decide what this screen shows.
  useEffect(() => {
    if (!isTauri) return;
    void (async () => {
      const [cfg, ent] = await Promise.all([commands.getAiConfig(), commands.getEntitlement()]);
      if (cfg.status === "ok") setAiReady(cfg.data.provider !== "none" && cfg.data.has_key);
      if (ent.status === "ok") setEntitled(ent.data.paid);
    })();
  }, []);

  const toggle = useCallback(async (id: string, enabled: boolean) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
    await commands.setRule(id, enabled);
  }, []);

  const deleteRule = useCallback(async (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
    await commands.deleteCustomRule(id);
  }, []);

  const importPack = useCallback(async (): Promise<number> => {
    const path = await open({
      multiple: false,
      filters: [{ name: "JSON pack", extensions: ["json"] }],
    });
    if (typeof path !== "string") return 0;
    const res = await commands.importPack(path);
    await refetch();
    return res.status === "ok" ? res.data : 0;
  }, [refetch]);

  return { rules, loading, failed, aiReady, entitled, toggle, deleteRule, importPack, refetch };
}
