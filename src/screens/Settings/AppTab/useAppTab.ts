import { useCallback, useEffect, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { ask } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { commands, isTauri } from "@/lib/ipc";
import { describeUpdateError } from "./AppTab.util";
import { RESET_CONFIRM, UNINSTALL_ARM_MS, UNINSTALL_CONFIRM } from "./AppTab.constants";
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
  const [uninstallArmed, setUninstallArmed] = useState(false);
  // The `Update` handle the check returned. It carries the download URL and
  // signature, so the install has to reuse the very object the check produced
  // rather than re-deriving one from the version string.
  const pending = useRef<Update | null>(null);
  // A download in flight. State cannot guard this: two clicks landing in the
  // same tick both read the pre-render value and both start a download.
  const downloading = useRef(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isTauri) return;
    void getVersion()
      .then(setVersion)
      .catch(() => setVersion(null));
  }, []);

  // A timer that outlives the tab would call into an unmounted component.
  useEffect(
    () => () => {
      if (armTimer.current) clearTimeout(armTimer.current);
    },
    [],
  );

  const runCheck = useCallback(async () => {
    if (!isTauri) return;
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
    if (!found || downloading.current) return;
    downloading.current = true;
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
    } finally {
      // Not reached on the happy path — `relaunch` takes the process with it.
      downloading.current = false;
    }
  }, []);

  /**
   * Confirm, run, and report.
   *
   * The OS dialog is a speed bump, not a lock: on macOS the confirm button is
   * the alert's default, so Return answers it. It is worth raising because it
   * is the one prompt the app cannot draw over or mis-render — but the real
   * guard against an accidental uninstall is the two-press arming below, which
   * runs before this is ever called.
   *
   * The outcome — success or failure — lands inline rather than in a second
   * dialog.
   */
  const runDanger = useCallback(
    async (
      key: Exclude<DangerBusy, "">,
      prompt: string,
      title: string,
      okLabel: string,
      command: () => Promise<{ status: "ok"; data: string } | { status: "error"; error: string }>,
    ) => {
      if (!isTauri) return;
      const confirmed = await ask(prompt, {
        title,
        kind: "warning",
        okLabel,
        cancelLabel: "Cancel",
      });
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

  /**
   * First press arms; the second, within {@link UNINSTALL_ARM_MS}, goes ahead.
   *
   * Reset is recoverable in the sense that matters — the app keeps working, and
   * a rescan rebuilds most of what was lost. Uninstall is not, so it costs two
   * deliberate presses before the OS is even asked. The window lapses on its
   * own so a half-finished thought does not stay loaded.
   */
  const uninstall = useCallback(async () => {
    if (!isTauri) return;
    if (!uninstallArmed) {
      setUninstallArmed(true);
      if (armTimer.current) clearTimeout(armTimer.current);
      armTimer.current = setTimeout(() => setUninstallArmed(false), UNINSTALL_ARM_MS);
      return;
    }
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = null;
    setUninstallArmed(false);
    await runDanger(
      "uninstall",
      UNINSTALL_CONFIRM,
      "Uninstall Prompt Janitor",
      "Uninstall",
      commands.uninstallApp,
    );
  }, [runDanger, uninstallArmed]);

  return {
    version,
    update,
    check: runCheck,
    install,
    danger,
    dangerResult,
    uninstallArmed,
    reset,
    uninstall,
  };
}
