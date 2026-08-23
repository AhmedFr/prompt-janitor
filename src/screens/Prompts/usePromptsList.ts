import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, isTauri, type FileRow } from "@/lib/ipc";
import type { PromptsState } from "./Prompts.types";

/**
 * Every scanned prompt file in one round trip, refetched whenever a scan
 * finishes — a scan is the only thing that can add a file, change a grade or
 * move an issue count.
 */
export function usePromptsList(): PromptsState {
  const [data, setData] = useState<FileRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!isTauri) {
      setLoading(false);
      return;
    }
    try {
      const res = await commands.listFiles();
      if (res.status === "ok") setData(res.data);
    } catch {
      // Surfaced by the screen as its failure panel; nothing to add here.
    } finally {
      // A failed query still ends the load: leaving the skeleton up forever
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
      void refetch();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [refetch]);

  return { data, loading, refetch };
}
