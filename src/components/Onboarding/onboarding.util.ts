import type { HarnessInfo } from "@/lib/ipc";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * What was found, in one line: "1 global setup · 12 projects · 88 sessions".
 * Each harness contributes one global setup; projects and sessions are summed
 * across all of them.
 */
export function detectedSummary(detected: HarnessInfo[]): string {
  return [
    `${detected.length} global ${detected.length === 1 ? "setup" : "setups"}`,
    plural(
      detected.reduce((n, h) => n + h.project_count, 0),
      "project",
    ),
    plural(
      detected.reduce((n, h) => n + h.session_count, 0),
      "session",
    ),
  ].join(" · ");
}
