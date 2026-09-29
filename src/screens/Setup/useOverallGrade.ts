import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, isTauri, type Grade } from "@/lib/ipc";

/** The whole setup's grade for the summary badge; `null` before the first scan. Refetches on `scan-done`. */
export function useOverallGrade(): { grade: Grade | null; loading: boolean } {
  const [grade, setGrade] = useState<Grade | null>(null);
  const [loading, setLoading] = useState(isTauri);
  const load = useCallback(async () => {
    if (!isTauri) return;
    try {
      const res = await commands.getOverview();
      setGrade(res.status === "ok" && res.data.has_data ? res.data.overall_grade : null);
    } catch {
      // A badge that fails to load simply is not shown.
      setGrade(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => void load(), [load]);
  useEffect(() => {
    if (!isTauri) return;
    const off = listen("scan-done", () => void load());
    return () => void off.then((fn) => fn());
  }, [load]);
  return { grade, loading };
}
