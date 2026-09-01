/**
 * Where the update flow is right now.
 *
 * One union rather than a handful of booleans: "checking", "downloading" and
 * "error" are mutually exclusive, and a shape that can express two of them at
 * once is a shape that will eventually show two of them at once.
 */
export type UpdateStatus =
  /** Nothing asked yet — the tab just opened. */
  | { kind: "idle" }
  | { kind: "checking" }
  /** The check came back with nothing newer. */
  | { kind: "current" }
  | { kind: "available"; version: string; notes: string | null }
  | { kind: "downloading"; version: string; downloaded: number; total: number }
  /** Installed; the app is on its way back up. */
  | { kind: "restarting"; version: string }
  | { kind: "error"; message: string };

/** Which destructive action is in flight, if any. */
export type DangerBusy = "" | "reset" | "uninstall";

/** The outcome of the last destructive action, shown inline under the buttons. */
export interface DangerResult {
  ok: boolean;
  message: string;
}

/**
 * Presentational half of the tab — rendered from state `useAppTab` owns. Kept
 * separate so a story can hand it a fixed state with no updater behind it.
 */
export interface AppTabBodyProps {
  /** The running build's version, or `null` until the runtime answers. */
  version: string | null;
  update: UpdateStatus;
  /** Ask the endpoint whether anything newer exists. */
  check: () => Promise<void>;
  /** Download the offered update and relaunch into it. */
  install: () => Promise<void>;
  danger: DangerBusy;
  dangerResult: DangerResult | null;
  /**
   * The uninstall button is one press in, waiting for the second. Drives the
   * button's label; the arming itself lives in the hook.
   */
  uninstallArmed: boolean;
  /** Confirm, then wipe the local database and start a fresh one. */
  reset: () => Promise<void>;
  /** Arm on the first press; on the second, confirm and uninstall. */
  uninstall: () => Promise<void>;
}

/** What `useAppTab` returns. */
export type UseAppTab = AppTabBodyProps;
