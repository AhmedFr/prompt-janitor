import { commands, type FixEdit } from "@/lib/ipc";
import { fixableEdits } from "@/lib/fixableEdits";

export interface AutoFixResult {
  files: number;
  edits: number;
  /** Files whose fix was refused or failed. */
  failed: number;
  firstError?: string;
}

/** Every graded file with findings and the deterministic fixes it carries. Applies nothing. */
export async function collectFixes(): Promise<{ fileId: string; edits: FixEdit[] }[]> {
  const list = await commands.listFiles();
  if (list.status !== "ok") return [];
  const out: { fileId: string; edits: FixEdit[] }[] = [];
  for (const f of list.data.filter((x) => x.issue_count > 0)) {
    const d = await commands.getFileDetail(f.id);
    if (d.status !== "ok" || !d.data) continue;
    const edits = fixableEdits(d.data);
    if (edits.length > 0) out.push({ fileId: f.id, edits });
  }
  return out;
}

/**
 * Every deterministic fix across every graded file with findings, then one
 * scan. The cross-file Auto-fix that lived on Overview (spec §4.2). Files
 * are fixed one at a time: `apply_fix` snapshots each for Undo.
 */
export async function autoFixAll(): Promise<AutoFixResult> {
  let files = 0;
  let edits = 0;
  let failed = 0;
  let firstError: string | undefined;
  for (const { fileId, edits: e } of await collectFixes()) {
    const r = await commands.applyFix(fileId, e, false, "auto");
    if (r.status === "ok") {
      files += 1;
      edits += e.length;
    } else {
      failed += 1;
      firstError ??= String(r.error);
    }
  }
  await commands.scanNow();
  return { files, edits, failed, ...(firstError ? { firstError } : {}) };
}
