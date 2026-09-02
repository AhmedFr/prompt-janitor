/** Accessible name of the download bar — it is not a scan, so it says so. */
export const DOWNLOAD_BAR_LABEL = "Update download progress";

/** Shown when the check found nothing newer. */
export const UP_TO_DATE = "You're on the latest version";

/**
 * The updater fails the same way whether the endpoint 404s or the manifest is
 * unparseable. Before the first tag is pushed there is simply nothing to
 * serve, and calling that an error sends users hunting for a problem that
 * does not exist.
 */
export const NO_RELEASES =
  "No published releases yet — in-app updates start with the first tagged release.";

/** DNS, offline, a proxy in the way: the one failure a user can act on. */
export const UNREACHABLE = "Couldn't reach the update server. Check your connection and try again.";

/** Last resort when the rejection carried no message at all. */
export const CHECK_FAILED = "The update check failed.";

/**
 * How long the "Confirm uninstall" state stays armed.
 *
 * The reset and uninstall confirmations themselves are raised natively by the
 * Rust commands (`src-tauri/src/app_data.rs`), where a script in the page
 * cannot skip them. On macOS the confirm button is that alert's default, so
 * Return alone answers it — one stray keypress on a focused button would
 * otherwise be the whole journey from "browsing Settings" to "app in the
 * Trash". Two deliberate clicks are required before the dialog is ever raised.
 */
export const UNINSTALL_ARM_MS = 5_000;

/** What the two destructive actions cannot take with them, said out loud. */
export const DANGER_NOTE =
  "Neither action touches your prompt files — Prompt Janitor only ever reads them where they live.";
