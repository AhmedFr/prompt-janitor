/** Top-level routes in the app shell. `detail` is reached from `prompts`/`overview`, not the sidebar. */
export type Route = "overview" | "prompts" | "detail" | "scans" | "rules" | "settings";

/**
 * Navigate to a route, optionally with a target: the file id for `detail`,
 * or the tab id (e.g. "ai", "license") for `settings`.
 */
export type Navigate = (route: Route, target?: string) => void;
