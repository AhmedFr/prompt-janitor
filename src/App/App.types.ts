/**
 * Top-level routes in the app shell. `detail` is reached from
 * `prompts`/`overview`/`projects`, `project` from the projects table, and
 * `rules-new` from the Rules screen — none of the three is a sidebar
 * destination.
 */
export type Route =
  | "overview"
  | "setup"
  | "projects"
  | "project"
  | "prompts"
  | "detail"
  | "scans"
  | "analytics"
  | "rules"
  | "rules-new"
  | "settings";

/**
 * Navigate to a route, optionally with a target: the file id for `detail`,
 * the project's root path for `project`, or the tab id (e.g. "ai", "license")
 * for `settings`.
 */
export type Navigate = (route: Route, target?: string) => void;
