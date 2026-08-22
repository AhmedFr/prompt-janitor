import { open } from "@tauri-apps/plugin-dialog";
import { commands } from "./bindings";

/** The extra folders currently configured, or `[]` if the call fails. */
async function currentFolders(): Promise<string[]> {
  const res = await commands.getExtraScanFolders();
  return res.status === "ok" ? res.data : [];
}

/** Add `dir` to the extra scanned folders (idempotent). Returns the new list. */
export async function addExtraFolder(dir: string): Promise<string[]> {
  const folders = await currentFolders();
  const next = folders.includes(dir) ? folders : [...folders, dir];
  await commands.setExtraScanFolders(next);
  return next;
}

/** Drop `dir` from the extra scanned folders. Returns the new list. */
export async function removeExtraFolder(dir: string): Promise<string[]> {
  const next = (await currentFolders()).filter((f) => f !== dir);
  await commands.setExtraScanFolders(next);
  return next;
}

/**
 * Prompt for a folder to scan on top of what the harnesses already cover,
 * add it, and rescan. No-op if the user cancels.
 */
export async function pickAndScan(): Promise<boolean> {
  const dir = await open({ directory: true, multiple: false, title: "Choose a folder to scan" });
  if (typeof dir !== "string") return false;
  await addExtraFolder(dir);
  await commands.scanNow();
  return true;
}

/** Re-scan everything: every detected harness plus the extra folders. */
export async function rescan(): Promise<void> {
  await commands.scanNow();
}
