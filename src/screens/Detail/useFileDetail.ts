import { useEffect, useState } from "react";
import { commands, isTauri, type FileDetail } from "@/lib/ipc";

/** Loads a single file's source + issues whenever the selected file changes. */
export function useFileDetail(fileId: string | null) {
  const [detail, setDetail] = useState<FileDetail | null>(null);
  const [loading, setLoading] = useState(true);

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

  return { detail, loading };
}
