import { isTauri } from "./ipc";

/**
 * Open a URL in the user's default browser via the opener plugin.
 * No-ops gracefully outside the Tauri runtime (plain browser dev/storybook).
 */
export async function openExternal(url: string): Promise<void> {
  if (!isTauri) return;
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } catch {
    // Opening the browser is best-effort — never crash the UI over it.
  }
}
