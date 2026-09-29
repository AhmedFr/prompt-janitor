import { useCallback, useEffect, useState } from "react";
import { commands, isTauri, type SourceFormat } from "@/lib/ipc";
import type { ArtifactSourceState } from "../Setup.types";

const NOT_IN_SCAN = "That file is no longer in the scan.";

const formatFor = (path: string): SourceFormat => (/\.(md|mdc)$/i.test(path) ? "markdown" : "text");

/**
 * A graded file with no inventory row, read through its file detail. Read-only:
 * there is no artifact id to save through, so `save` always declines.
 */
export function useGradedSource(fileId: string): ArtifactSourceState {
  const [content, setContent] = useState<string | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const read = useCallback(async () => {
    if (!isTauri) return;
    setLoading(true);
    setError(null);
    const res = await commands.getFileDetail(fileId);
    if (res.status === "ok" && res.data) {
      setContent(res.data.content);
      setPath(res.data.path);
    } else setError(res.status === "ok" ? NOT_IN_SCAN : res.error);
    setLoading(false);
  }, [fileId]);

  useEffect(() => void read(), [read]);

  return {
    content,
    path,
    format: path ? formatFor(path) : null,
    editable: false,
    modified: null,
    loading,
    saving: false,
    error,
    save: async () => null,
    reload: () => void read(),
  };
}
