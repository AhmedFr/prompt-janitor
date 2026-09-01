import { CHECK_FAILED, NO_RELEASES, UNREACHABLE } from "./AppTab.constants";

const KB = 1_000;
const MB = 1_000_000;

/**
 * A download size a human can read. Decimal units on purpose — the number next
 * to it is the one the browser and the release page report.
 */
export function formatBytes(bytes: number): string {
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes >= KB) return `${(bytes / KB).toFixed(1)} kB`;
  return `${Math.round(bytes / KB)} kB`;
}

/**
 * The line under the download bar. A server that sent no `content-length`
 * leaves the total at zero — better to report only what has arrived than to
 * quote a denominator we do not have.
 */
export function downloadStatus(downloaded: number, total: number): string {
  if (total > 0 && downloaded >= total) return "Downloaded — installing…";
  if (total > 0) return `Downloading ${formatBytes(downloaded)} of ${formatBytes(total)}`;
  return `Downloading ${formatBytes(downloaded)}…`;
}

/** Anything the updater rejected with, as text. */
const messageOf = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
};

/**
 * Turn an updater rejection into a line the user can act on.
 *
 * The case worth spelling out is the first one: with no release published, the
 * endpoint 404s and the plugin rejects with a manifest-parse failure. That is
 * the expected state of a freshly installed app, not a fault, and dressing it
 * up as a red error teaches users to distrust the button.
 */
export function describeUpdateError(error: unknown): string {
  const message = messageOf(error);
  if (!message) return CHECK_FAILED;
  if (/release json|404|not found/i.test(message)) return NO_RELEASES;
  if (/error sending request|network|dns|timed? ?out|connect|offline/i.test(message)) {
    return UNREACHABLE;
  }
  return message;
}
