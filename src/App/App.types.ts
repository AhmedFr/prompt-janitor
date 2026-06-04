/** Top-level routes in the app shell. `detail` is reached from `prompts`/`overview`, not the sidebar. */
export type Route = "overview" | "prompts" | "detail" | "scans" | "rules" | "settings";

/** Navigate to a route, optionally targeting a file (for `detail`). */
export type Navigate = (route: Route, fileId?: string) => void;
