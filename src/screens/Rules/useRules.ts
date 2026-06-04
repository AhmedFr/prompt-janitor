import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { commands, isTauri, type RuleInfo } from "@/lib/ipc";

/** Fetches the built-in rules and toggles them (optimistically + persisted). */
export function useRules() {
  const [rules, setRules] = useState<RuleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiReady, setAiReady] = useState(false);

  const refetch = useCallback(async () => {
    if (!isTauri) {
      setLoading(false);
      return;
    }
    const res = await commands.listRules();
    if (res.status === "ok") setRules(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Natural-language rules need a provider + key; gate their composer on it.
  useEffect(() => {
    if (!isTauri) return;
    void commands.getAiConfig().then((r) => {
      if (r.status === "ok") setAiReady(r.data.provider !== "none" && r.data.has_key);
    });
  }, []);

  const toggle = useCallback(async (id: string, enabled: boolean) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
    await commands.setRule(id, enabled);
  }, []);

  const addRule = useCallback(
    async (title: string, pattern: string, severity: string) => {
      await commands.addCustomRule(title, pattern, severity);
      await refetch();
    },
    [refetch],
  );

  const addNlRule = useCallback(
    async (title: string, instruction: string, severity: string) => {
      await commands.addNlRule(title, instruction, severity);
      await refetch();
    },
    [refetch],
  );

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

  return { rules, loading, aiReady, toggle, addRule, addNlRule, deleteRule, importPack };
}
