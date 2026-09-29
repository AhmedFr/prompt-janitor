import type { Route } from "./App.types";

/**
 * Every destination the shell can show, as a value — the `Route` union is
 * derived from it. A route arriving from outside the app is resolved by
 * `resolveExternal`, which knows the legacy names too; this list is the
 * runtime check for a current one.
 */
export const ROUTES = ["setup", "projects", "settings"] as const;

/** Whether a string names one of the shell's destinations (legacy routes do not). */
export const isRoute = (value: string): value is Route =>
  (ROUTES as readonly string[]).includes(value);
