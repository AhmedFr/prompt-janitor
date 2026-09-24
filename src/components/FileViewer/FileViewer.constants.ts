import type { CodeLanguage } from "@/components/CodeView";
import type { ViewMode } from "./FileViewer.types";

export const MODE_LABEL: Record<ViewMode, string> = { rendered: "Rendered", source: "Source" };

/** Named in the bar when a file has only its source to show. */
export const LANGUAGE_LABEL: Record<CodeLanguage, string> = {
  markdown: "Markdown",
  json: "JSON",
  toml: "TOML",
  yaml: "YAML",
  shell: "Shell",
};
export const PLAIN_TEXT = "Plain text";

export const FIND_BUTTON = "Find in file";
/** The shortcut hint drawn on the find button. */
export const FIND_SHORTCUT = "⌘F";
export const MODE_GROUP_LABEL = "View";
export const RETRY = "Try again";
export const EMPTY_FILE = "This file is empty.";

export const readingLabel = (name: string) => `Reading ${name}…`;
export const errorTitle = (name: string) => `Couldn't open ${name}`;
export const sourceLabel = (name: string) => `${name} source`;

/** Widths of the loading placeholder's lines, in `ch` — a file's ragged edge, not a bar chart. */
export const SKELETON_LINES = [18, 42, 36, 0, 54, 48, 30, 0, 44, 26];
