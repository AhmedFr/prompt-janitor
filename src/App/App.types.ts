import type { ROUTES } from "./App.constants";

/**
 * The shell's three destinations (spec §3.1). Every other route a link may
 * still name (`detail`, `project`, `rules`, …) resolves to one of them
 * through `resolveExternal`.
 *
 * Derived from {@link ROUTES} so the guard and the union cannot drift: a route
 * added to one is added to both.
 */
export type Route = (typeof ROUTES)[number];

/**
 * Navigate to a route, optionally with a target: a Setup deep link
 * (`formatSetupTarget`) for `setup`, or the tab id (e.g. "ai") for
 * `settings`. Any route string is accepted; old ones (`detail`, `project`,
 * `rules`, …) resolve through `resolveExternal`.
 */
export type Navigate = (route: Route | (string & {}), target?: string) => void;
