import { useCallback, useEffect, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { ask } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { commands, isTauri } from "@/lib/ipc";
import { describeUpdateError } from "./AppTab.util";
import { RESET_CONFIRM, UNINSTALL_CONFIRM } from "./AppTab.constants";
import type { DangerBusy, DangerResult, UpdateStatus, UseAppTab } from "./AppTab.types";

/**
 * Settings → App: the running version, and the check → download → relaunch
 * path the user drives by hand.
 *
 * The launch-time probe ({@link useUpdateCheck}) is silent by design; this is
 * the half that answers out loud, including when the answer is a failure.
 */
export function useAppTab(): UseAppTab {
  const [version, setVersion] = useState<string | null>(null);
  const [update, setUpdate] = useState<UpdateStatus>({ kind: "idle" });
  const [danger, setDanger] = useState<DangerBusy>("");
  const [dangerResult, setDangerResult] = useState<DangerResult | null>(null);
  // The `Update` handle the check returned. It carries the download URL and
  // signature, so the install has to reuse the very object the check produced
  // rather than re-deriving one from the version string.
  const pending = useRef<Update | null>(null);

  useEffect(() => {
    if (!isTauri) return;
    void getVersion()
      .then(setVersion)
      .catch(() => setVersion(null));
  }, []);

  const runCheck = useCallback(async () => {
    setUpdate({ kind: "checking" });
    try {
      const found = await check();
      pending.current = found ?? null;
      setUpdate(
        found
          ? { kind: "available", version: found.version, notes: found.body ?? null }
          : { kind: "current" },
      );
    } catch (error) {
      pending.current = null;
      setUpdate({ kind: "error", message: describeUpdateError(error) });
    }
  }, []);

  const install = useCallback(async () => {
    const found = pending.current;
    if (!found) return;
    let downloaded = 0;
    let total = 0;
    setUpdate({ kind: "downloading", version: found.version, downloaded, total });
    try {
      await found.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            total = event.data.contentLength ?? 0;
            downloaded = 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            break;
          case "Finished":
            // A server that sent no content-length leaves `total` at zero;
            // squaring the two here is what lets the bar finish rather than
            // hang a hair short.
            total = total || downloaded;
            downloaded = total;
            break;
        }
        setUpdate({ kind: "downloading", version: found.version, downloaded, total });
      });
      setUpdate({ kind: "restarting", version: found.version });
      await relaunch();
    } catch (error) {
      setUpdate({ kind: "error", message: describeUpdateError(error) });
    }
  }, []);

  /**
   * Confirm, run, and report. Both destructive actions share this shape: the
   * OS dialog is the guard (an in-page "are you sure" is one stray Enter away
   * from being dismissed by muscle memory), and the outcome — success or
   * failure — lands inline rather than in a second dialog.
   */
  const runDanger = useCallback(
    async (
      key: Exclude<DangerBusy, "">,
      prompt: string,
      title: string,
      okLabel: string,
      command: () => Promise<{ status: "ok"; data: string } | { status: "error"; error: string }>,
    ) => {
      const confirmed = await ask(prompt, { title, kind: "warning", okLabel, cancelLabel: "Cancel" });
      if (!confirmed) return;
      setDanger(key);
      setDangerResult(null);
      try {
        const result = await command();
        setDangerResult(
          result.status === "ok"
            ? { ok: true, message: result.data }
            : { ok: false, message: result.error },
        );
      } catch (error) {
        setDangerResult({ ok: false, message: String(error) });
      } finally {
        setDanger("");
      }
    },
    [],
  );

  const reset = useCallback(
    () => runDanger("reset", RESET_CONFIRM, "Reset app data", "Reset", commands.resetAppData),
    [runDanger],
  );

  const uninstall = useCallback(
    () =>
      runDanger(
        "uninstall",
        UNINSTALL_CONFIRM,
        "Uninstall Prompt Janitor",
        "Uninstall",
        commands.uninstallApp,
      ),
    [runDanger],
  );

  return { version, update, check: runCheck, install, danger, dangerResult, reset, uninstall };
}
