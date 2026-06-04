import { open } from "@tauri-apps/plugin-dialog";
import { commands } from "./bindings";

/** Prompt for a folder, persist it, and scan it. No-op if the user cancels. */
export async function pickAndScan(): Promise<boolean> {
  const dir = await open({ directory: true, multiple: false, title: "Choose a folder to scan" });
  if (typeof dir !== "string") return false;
  await commands.setScanFolder(dir);
  await commands.scanNow(dir);
  return true;
}

/** Re-scan the already-configured folder. */
export async function rescan(folder: string): Promise<void> {
  await commands.scanNow(folder);
}
