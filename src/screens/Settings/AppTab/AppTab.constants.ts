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
 * The reset confirmation. Names what goes and, just as importantly, what
 * happens next — a destructive prompt that does not say the app survives
 * reads like it might not.
 *
 * The licence and AI keys live in the `settings` table, so they go with it.
 * "Settings" alone does not convey that; a user who discovers it afterwards
 * learns that this prompt understated what it was asking for.
 */
export const RESET_CONFIRM =
  "Delete the local database, backups and settings? The app keeps running with a fresh database. " +
  "You'll need to re-enter your licence key and AI settings afterwards.";

/** The uninstall confirmation. */
export const UNINSTALL_CONFIRM =
  "Remove all app data and move Prompt Janitor to the Trash? The app will quit. " +
  "Your licence key and AI settings go with it — you'll need to re-enter them if you reinstall.";

/**
 * How long the "Confirm uninstall" state stays armed.
 *
 * On macOS the confirm button is the alert's default, so Return alone answers
 * it — one stray keypress on a focused button would otherwise be the whole
 * journey from "browsing Settings" to "app in the Trash". Two deliberate
 * clicks are required before the OS dialog is ever raised.
 */
export const UNINSTALL_ARM_MS = 5_000;

/** What the two destructive actions cannot take with them, said out loud. */
export const DANGER_NOTE =
  "Neither action touches your prompt files — Prompt Janitor only ever reads them where they live.";
