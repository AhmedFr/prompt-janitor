import { useCallback, useEffect, useState } from "react";
import { commands, isTauri, type FileDetail } from "@/lib/ipc";

/** Loads a single file's source + issues whenever the selected file changes. */
export function useFileDetail(fileId: string | null) {
  const [detail, setDetail] = useState<FileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiReady, setAiReady] = useState(false);
  const [entitled, setEntitled] = useState(false);

  /** Re-fetch the file from disk + DB (after an apply/undo, or a fresh scan). */
  const reload = useCallback(async () => {
    if (!isTauri || !fileId) return;
    const res = await commands.getFileDetail(fileId);
    setDetail(res.status === "ok" ? res.data : null);
  }, [fileId]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!isTauri || !fileId) {
        setDetail(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const res = await commands.getFileDetail(fileId);
      if (!active) return;
      setDetail(res.status === "ok" ? res.data : null);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [fileId]);

  // Provider config + entitlement are stable across files — load once. A rewrite
  // needs a provider + key (or `suggest_fix` fails) AND a paid license (or it's
  // gated server-side).
  useEffect(() => {
    let active = true;
    async function loadGates() {
      if (!isTauri) return;
      const [cfg, ent] = await Promise.all([commands.getAiConfig(), commands.getEntitlement()]);
      if (!active) return;
      if (cfg.status === "ok") setAiReady(cfg.data.provider !== "none" && cfg.data.has_key);
      if (ent.status === "ok") setEntitled(ent.data.paid);
    }
    void loadGates();
    return () => {
      active = false;
    };
  }, []);

  return { detail, loading, aiReady, entitled, reload };
}
