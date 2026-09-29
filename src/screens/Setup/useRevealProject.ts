import { useCallback, useEffect, useRef, useState } from "react";
import { commands } from "@/lib/ipc";

/**
 * Reveal in Finder for the lensed project. A reveal that failed says why; the
 * error belongs to the project it was for, so it clears when the lens moves,
 * and a late answer for a project the lens has left is dropped.
 */
export function useRevealProject(path: string | null) {
  const [error, setError] = useState<string | null>(null);
  const current = useRef(path);
  useEffect(() => {
    current.current = path;
    setError(null);
  }, [path]);
  const reveal = useCallback(async () => {
    if (!path) return;
    setError(null);
    let failure: string | null = null;
    try {
      const result = await commands.revealProject(path);
      if (result.status === "error") failure = result.error;
    } catch (e) {
      failure = e instanceof Error ? e.message : String(e);
    }
    if (current.current === path) setError(failure);
  }, [path]);
  return { error, reveal };
}
