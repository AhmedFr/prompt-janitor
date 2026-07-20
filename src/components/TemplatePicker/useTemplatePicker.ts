import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { commands, isTauri, type TemplateInfo } from "@/lib/ipc";
import type { ApplyOutcome } from "./TemplatePicker.types";

/** Rescan the configured folder so a freshly-written file gets graded. */
async function rescanConfigured(): Promise<void> {
  const f = await commands.getScanFolder();
  if (f.status === "ok" && f.data) await commands.scanNow(f.data);
}

/** Find the scanned file id whose path matches exactly what was just written. */
async function findFileId(path: string): Promise<string | null> {
  const res = await commands.listFiles();
  if (res.status !== "ok") return null;
  return res.data.find((f) => f.path === path)?.id ?? null;
}

/**
 * Loads the starter template catalog + entitlement, and drives applying one:
 * pick a folder, write the file, rescan, and resolve the new file's id (if
 * the scan picked it up) so the caller can jump straight to its Detail view.
 */
export function useTemplatePicker() {
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [entitled, setEntitled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!isTauri) {
        setLoading(false);
        return;
      }
      const [list, ent] = await Promise.all([commands.listTemplates(), commands.getEntitlement()]);
      if (!active) return;
      setTemplates(list);
      setEntitled(ent.status === "ok" && ent.data.paid);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  /** Pick a destination folder, write `templateId`'s file into it, and rescan. */
  const applyTemplate = async (templateId: string): Promise<ApplyOutcome> => {
    const dir = await open({ directory: true, multiple: false, title: "Choose a folder for this file" });
    if (typeof dir !== "string") return { status: "cancelled" };

    const res = await commands.applyTemplate(templateId, dir);
    if (res.status !== "ok") return { status: "error", message: res.error };

    await rescanConfigured();
    const fileId = await findFileId(res.data.path);
    return { status: "done", path: res.data.path, fileId };
  };

  return { templates, entitled, loading, applyTemplate };
}
