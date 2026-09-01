/**
 * Which window this document is.
 *
 * The menu-bar popover loads the same bundle as the app shell with
 * `?window=panel`. Query-string detection (rather than a Tauri window API)
 * keeps Storybook and the tests free of a desktop runtime.
 */

/** True when this document is the menu-bar panel window. */
export const isPanelWindow = (): boolean =>
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("window") === "panel";
