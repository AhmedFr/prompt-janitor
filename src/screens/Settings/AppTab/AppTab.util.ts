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
 * The updater's own words for "the endpoint served nothing I can parse",
 * which is exactly what a 404 on `latest.json` produces. Matched in full
 * rather than on "not found" or "404": the plugin also says "not found" when
 * a manifest *does* exist but omits this platform, or when the downloaded
 * archive holds no binary for it — real, reportable faults that must not be
 * dressed up as "there is no release yet".
 */
const NOTHING_PUBLISHED = /could not fetch a valid release json/i;

/** Reaching the endpoint failed outright, rather than the endpoint answering. */
const NO_CONNECTION = /error sending request|network error|dns|timed? ?out|offline/i;

/**
 * Turn an updater rejection into a line the user can act on.
 *
 * The case worth spelling out is the first one: with no release published, the
 * endpoint 404s and the plugin rejects with a manifest-parse failure. That is
 * the expected state of a freshly installed app, not a fault, and dressing it
 * up as a red error teaches users to distrust the button.
 *
 * Everything else is passed through verbatim. An error we have not learned to
 * explain is more useful in the user's own words than reworded into a guess.
 */
export function describeUpdateError(error: unknown): string {
  const message = messageOf(error);
  if (!message) return CHECK_FAILED;
  if (NOTHING_PUBLISHED.test(message)) return NO_RELEASES;
  if (NO_CONNECTION.test(message)) return UNREACHABLE;
  return message;
}
