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
}

/** What `useAppTab` returns. */
export type UseAppTab = AppTabBodyProps;
