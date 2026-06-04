import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, isTauri, type ScansDigest } from "@/lib/ipc";

/** Fetches the weekly digest and refetches whenever a scan finishes. */
export function useScansDigest() {
  const [digest, setDigest] = useState<ScansDigest | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!isTauri) {
      setLoading(false);
      return;
    }
    const res = await commands.getScansDigest();
    if (res.status === "ok") setDigest(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (!isTauri) return;
    const unlisten = listen("scan-done", () => void refetch());
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [refetch]);

  return { digest, loading };
}
