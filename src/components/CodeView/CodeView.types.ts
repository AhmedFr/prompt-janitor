/** The grammars the viewer can colour. Anything else is drawn as plain text. */
export type CodeLanguage = "markdown" | "json" | "toml" | "yaml" | "shell";

/** A run of text on one line, and the highlight.js classes it carries. */
export interface CodeToken {
  text: string;
  /** `hljs-*` class names, outermost first. Empty for unhighlighted text. */
  classes: string[];
}

export interface CodeViewProps {
  /** The file exactly as read. */
  content: string;
  /** What to colour it as; `null` draws it as plain text. */
  language: CodeLanguage | null;
  /** Names the region for assistive tech ("SKILL.md source"). */
  ariaLabel: string;
}
