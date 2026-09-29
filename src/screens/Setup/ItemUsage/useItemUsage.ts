import { useEffect, useState } from "react";
import { commands, isTauri, type ArtifactUsage } from "@/lib/ipc";

/**
 * Loads one inventory item's usage over a 30 or 90 day window. A graded-only
 * row has a synthetic negative id and no `artifacts` row, so it is never asked
 * for. A response landing after the inputs changed is dropped. A read that
 * fails (an error status, or a rejected invoke) ends the load as `failed`.
 */
export function useItemUsage(
  artifactId: number | null,
  windowDays: 30 | 90,
): { usage: ArtifactUsage | null; loading: boolean; failed: boolean } {
  const [usage, setUsage] = useState<ArtifactUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (artifactId === null || artifactId <= 0 || !isTauri) {
      setUsage(null);
      setLoading(false);
      setFailed(false);
      return;
    }
    let active = true;
    setLoading(true);
    setFailed(false);
    void commands
      .getArtifactUsage(artifactId, windowDays)
      .then((result) => {
        if (!active) return;
        setUsage(result.status === "ok" ? result.data : null);
        setFailed(result.status !== "ok");
      })
      .catch(() => {
        if (!active) return;
        setUsage(null);
        setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [artifactId, windowDays]);

  return { usage, loading, failed };
}
