import { commands, type FixEdit } from "@/lib/ipc";

export type ApplyOutcome = { ok: boolean; message: string };

/** Rescan the configured folder so grades reflect the file's new content. */
async function rescanConfigured(): Promise<void> {
  const f = await commands.getScanFolder();
  if (f.status === "ok" && f.data) await commands.scanNow(f.data);
}

/** Apply edits to a file (optionally committing to git), then rescan. */
export async function applyFix(
  fileId: string,
  edits: FixEdit[],
  commit: boolean,
): Promise<ApplyOutcome> {
  const res = await commands.applyFix(fileId, edits, commit);
  if (res.status !== "ok") return { ok: false, message: res.error };
  await rescanConfigured();
  const branch = res.data.git_ref;
  return { ok: true, message: branch ? `Applied · committed to ${branch}` : "Applied" };
}

/** Restore a file's last pre-fix snapshot, then rescan. */
export async function undoFix(fileId: string): Promise<ApplyOutcome> {
  const res = await commands.undoFix(fileId);
  if (res.status !== "ok") return { ok: false, message: res.error };
  await rescanConfigured();
  return { ok: true, message: "Reverted" };
}
