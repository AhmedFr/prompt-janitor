import type { ROUTES } from "./App.constants";

/**
 * Top-level routes in the app shell. `detail` is reached from
 * `prompts`/`overview`/`projects`, `project` from the projects table, and
 * `rules-new` from the Rules screen — none of the three is a sidebar
 * destination.
 *
 * Derived from {@link ROUTES} so the guard and the union cannot drift: a route
 * added to one is added to both.
 */
export type Route = (typeof ROUTES)[number];

/**
 * Navigate to a route, optionally with a target: the file id for `detail`,
 * the project's root path for `project`, the artifact kind (e.g. "mcp_server")
 * for `setup`, or the tab id (e.g. "ai", "license") for `settings`.
 */
export type Navigate = (route: Route, target?: string) => void;
