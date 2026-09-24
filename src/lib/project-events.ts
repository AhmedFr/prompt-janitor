/**
 * Core events after which the project list may differ: `scan-done` (a scan
 * rebuilt it) and `projects-changed` (a command changed it without one, such
 * as removing a scan folder). Every view of the project list refetches on both.
 */
export const PROJECT_EVENTS = ["scan-done", "projects-changed"] as const;
