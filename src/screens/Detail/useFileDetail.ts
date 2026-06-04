import { useEffect, useState } from "react";
import { commands, isTauri, type FileDetail } from "@/lib/ipc";

/** Loads a single file's source + issues whenever the selected file changes. */
export function useFileDetail(fileId: string | null) {
  const [detail, setDetail] = useState<FileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiReady, setAiReady] = useState(false);

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

  // AI config is stable across files — load it once. A rewrite needs both a
  // provider and a stored key, or `suggest_fix` would fail with "no key".
  useEffect(() => {
    let active = true;
    async function loadAi() {
      if (!isTauri) return;
      const cfg = await commands.getAiConfig();
      if (active && cfg.status === "ok") {
        setAiReady(cfg.data.provider !== "none" && cfg.data.has_key);
      }
    }
    void loadAi();
    return () => {
      active = false;
    };
  }, []);

  return { detail, loading, aiReady };
}
