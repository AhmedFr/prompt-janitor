import { useCallback, useEffect, useState } from "react";
import { commands, isTauri, type FileDetail } from "@/lib/ipc";
import { isUnlocked } from "@/lib/monetization";

/** What one graded file's view needs: the file, and whether AI rewrites may run. */
export interface FileDetailState {
  /** The file; `null` once loading is done means the read failed (an error, or a rejected invoke). */
  detail: FileDetail | null;
  loading: boolean;
  aiReady: boolean;
  entitled: boolean;
  reload: () => Promise<void>;
}

/** Loads a single file's source + issues whenever the selected file changes. */
export function useFileDetail(fileId: string | null): FileDetailState {
  const [detail, setDetail] = useState<FileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiReady, setAiReady] = useState(false);
  const [entitled, setEntitled] = useState(isUnlocked(undefined));

  /** Re-fetch the file from disk + DB (after an apply/undo, or a fresh scan). */
  // A rejected re-read keeps what is shown: the file on screen is still the last good read.
  const reload = useCallback(async () => {
    if (!isTauri || !fileId) return;
    try {
      const res = await commands.getFileDetail(fileId);
      setDetail(res.status === "ok" ? res.data : null);
    } catch {
      // Nothing newer to show; the caller's view stays as it was.
    }
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
      try {
        const res = await commands.getFileDetail(fileId);
        if (!active) return;
        setDetail(res.status === "ok" ? res.data : null);
      } catch {
        if (!active) return;
        // No file to show: the view's failed state, with its Retry.
        setDetail(null);
      }
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
      // A gate that cannot be read stays closed (AI) or at its default (entitlement).
      const [cfg, ent] = await Promise.all([commands.getAiConfig(), commands.getEntitlement()]).catch(() => [null, null]);
      if (!active || !cfg || !ent) return;
      if (cfg.status === "ok") setAiReady(cfg.data.provider !== "none" && cfg.data.has_key);
      setEntitled(isUnlocked(ent.status === "ok" ? ent.data.paid : undefined));
    }
    void loadGates();
    return () => {
      active = false;
    };
  }, []);

  return { detail, loading, aiReady, entitled, reload };
}
