import { commands, type FixEdit } from "@/lib/ipc";

export type ApplyOutcome = { ok: boolean; message: string };

/** Rescan everything so grades reflect the file's new content. */
async function rescanConfigured(): Promise<void> {
  await commands.scanNow();
}

/** Apply edits to a file (optionally committing to git), then rescan.
 * `origin` records how the fix was triggered — `"manual"` for a single
 * user-picked issue, `"auto"` for a bulk/auto-fix pass — so the Analytics
 * page can report a real "issues fixed" count split by origin. */
export async function applyFix(
  fileId: string,
  edits: FixEdit[],
  commit: boolean,
  origin: "auto" | "manual",
): Promise<ApplyOutcome> {
  const res = await commands.applyFix(fileId, edits, commit, origin);
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
