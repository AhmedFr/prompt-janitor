import { useCallback, useEffect, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { isTauri } from "./ipc";
import { isPanelWindow } from "./window-kind";

/**
 * How long after the shell mounts the silent update probe runs. Long enough
 * that a launch is never slowed by a network round trip, short enough that the
 * banner is there by the time the user has finished reading the Overview.
 */
export const UPDATE_CHECK_DELAY_MS = 10_000;

/** Session-storage key holding the version the user waved away. */
export const UPDATE_DISMISSED_KEY = "pj-update-dismissed";

/** A private window, cleared site data, or a browser blocking storage. */
const readDismissed = (): string | null => {
  try {
    return sessionStorage.getItem(UPDATE_DISMISSED_KEY);
  } catch {
    return null;
  }
};

const writeDismissed = (version: string) => {
  try {
    sessionStorage.setItem(UPDATE_DISMISSED_KEY, version);
  } catch {
    // Nothing to do: the banner is already hidden for this render, and the
    // worst case is that it comes back on the next launch.
  }
};

/** What the shell needs to draw (or not draw) the update banner. */
export interface UpdateCheck {
  /** The version the endpoint offers, or `null` when there is nothing to say. */
  version: string | null;
  /** Hide the banner, and keep this version quiet for the rest of the session. */
  dismiss: () => void;
}

/**
 * Asks the updater endpoint once, shortly after launch, whether a newer build
 * exists — so the app can mention it without the user going looking.
 *
 * Deliberately quiet: a launch probe that pops a dialog on a flaky network, or
 * before any release has ever been published, is worse than one that says
 * nothing. Failures are swallowed; the Settings → App tab is where a user who
 * *asks* gets a real answer (and a real error).
 *
 * Main window only — the menu-bar panel loads the same bundle, and two windows
 * probing the same endpoint on every launch is one probe too many.
 */
export function useUpdateCheck(): UpdateCheck {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri || isPanelWindow()) return;
    let live = true;
    const timer = setTimeout(() => {
      void check()
        .then((update) => {
          if (!live || !update) return;
          if (readDismissed() === update.version) return;
          setVersion(update.version);
        })
        .catch(() => {
          // No release published yet, no network, a proxy in the way — none of
          // it is worth interrupting a launch for.
        });
    }, UPDATE_CHECK_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, []);

  const dismiss = useCallback(() => {
    if (version) writeDismissed(version);
    setVersion(null);
  }, [version]);

  return { version, dismiss };
}
