/**
 * Option count past which the popover grows its own filter box. Set at the
 * size where scanning stops being instant — Setup's Scope group on a machine
 * with a handful of projects and plugins is the only group in the app that
 * reaches it, and it is exactly the one that needs it.
 */
export const SEARCH_THRESHOLD = 8;

export const FILTER_PLACEHOLDER = "Filter…";
export const CLEAR_LABEL = "Clear";
export const NO_MATCH_LABEL = "No matches";

/** A group with nothing in it at all — where "No matches" would blame a query there isn't one of. */
export const NO_OPTIONS_LABEL = "No options";

/** Gap kept between the popover's edge and the window's before it flips sides. */
export const VIEWPORT_MARGIN = 8;

/** Separates the group's name from its selection on the trigger: "Scope · 2". */
export const VALUE_SEPARATOR = " · ";

/** Reads out past one selection, where naming them all would be a mouthful. */
export const SELECTED_SUFFIX = "selected";
