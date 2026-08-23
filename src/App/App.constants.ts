import type { Route } from "./App.types";

/**
 * Every route the shell can show, as a value — the `Route` union is derived
 * from it. A route arriving from outside the app (the panel's `navigate`
 * event) is a bare string, and only a runtime list can vet it.
 */
export const ROUTES = [
  "overview",
  "setup",
  "projects",
  "project",
  "prompts",
  "detail",
  "scans",
  "analytics",
  "rules",
  "rules-new",
  "settings",
] as const;

/** Whether a string names a route this shell knows how to render. */
export const isRoute = (value: string): value is Route =>
  (ROUTES as readonly string[]).includes(value);
