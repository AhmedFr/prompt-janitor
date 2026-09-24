import { useCallback, useEffect, useState } from "react";
import type { SourceFormat } from "@/lib/ipc";
import { defaultMode, modesFor } from "./fileViewer.util";
import type { FileViewerState, ViewMode } from "./FileViewer.types";

/**
 * The viewer's own state: which mode it shows, and find.
 *
 * The mode is held as a *preference* and resolved against the format on
 * every render, so a sheet that mounts before its file is read (no format
 * yet) lands on the right view when the read does, without an effect racing
 * it — and a "rendered" preference simply cannot apply to a JSON file.
 *
 * ⌘F (Ctrl+F too) is caught on the window rather than on the viewer: the
 * sheet takes focus on open, on its own panel, which is outside the viewer,
 * and a shortcut that only works after a click into the text is one nobody
 * discovers. `searchable` is off while loading, failed or editing.
 */
export function useFileViewer(
  format: SourceFormat | null,
  searchable: boolean,
  initialMode?: ViewMode,
): FileViewerState {
  const [preferred, setMode] = useState<ViewMode | null>(initialMode ?? null);
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [findFocus, setFindFocus] = useState(0);

  const available = format ? modesFor(format) : [];
  const mode = preferred && available.includes(preferred) ? preferred : format ? defaultMode(format) : "rendered";

  const openFind = useCallback(() => {
    setFindOpen(true);
    setFindFocus((n) => n + 1);
  }, []);
  const closeFind = useCallback(() => setFindOpen(false), []);

  useEffect(() => {
    if (!searchable) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        openFind();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchable, openFind]);

  return { mode, setMode, findOpen, openFind, closeFind, query, setQuery, findFocus };
}
