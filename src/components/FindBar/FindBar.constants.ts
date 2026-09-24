/** The `CSS.highlights` registry names; `FindBar.css` styles them with `::highlight()`. */
export const MATCH_HIGHLIGHT = "pj-find";
export const CURRENT_HIGHLIGHT = "pj-find-current";

/**
 * What counts as a block for find: a match never spans two of them. Code rows
 * mark themselves with `data-find-block`; rendered markdown already uses the
 * elements below, so it needs no markup of its own.
 */
export const BLOCK_SELECTOR = "[data-find-block], p, li, h1, h2, h3, h4, h5, h6, pre, td, th, dt, dd, blockquote";

/** Subtrees find never looks inside — the code view's line numbers. */
export const SKIP_SELECTOR = "[data-find-skip]";

export const FIND_LABEL = "Find in file";
export const NO_MATCHES = "No matches";
export const PREVIOUS_LABEL = "Previous match";
export const NEXT_LABEL = "Next match";
export const CLOSE_LABEL = "Close find";
