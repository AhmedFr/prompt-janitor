import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, isTauri, type SetupView } from "@/lib/ipc";
import type { SetupState } from "./Setup.types";

/**
 * Loads the whole setup inventory in one round trip, and refetches whenever a
 * scan finishes. Everything the screen shows is a slice of that one view —
 * the per-kind tables filter it client-side, so there is no second query to
 * make and nothing to memoise per project.
 */
export function useSetup(): SetupState {
  const [data, setData] = useState<SetupView | null>(null);
  const [loading, setLoading] = useState(true);

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
      void refetch();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [refetch]);

  return { data, loading, refetch };
}
