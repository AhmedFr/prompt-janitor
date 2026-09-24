/**
 * The subset of Markdown a skill file actually uses. Deliberately not
 * CommonMark: tables, reference links, setext headings, nested lists and raw
 * HTML are all absent, because supporting them means either a dependency or a
 * parser nobody in this repo wants to own. Anything unrecognised degrades to a
 * paragraph, which is the honest failure mode — the text is still readable.
 */
export type Block =
  | { kind: "heading"; level: HeadingLevel; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "code"; lang: string | null; text: string }
  | { kind: "quote"; text: string }
  | { kind: "hr" };

/** ATX headings run `#` to `######`; a seventh `#` is not a heading at all. */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * A run of inline markup inside one block's text.
 *
 * `link` carries a href already vetted by {@link safeHref} — a scheme the
 * parser refused never reaches this type, it stays `text` instead. That is
 * what lets the renderer put `span.href` straight into an anchor without
 * re-checking it.
 */
export type Span =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "em"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; href: string };

export interface MarkdownProps {
  /** The raw markdown source. Frontmatter, if any, should be stripped first. */
  source: string;
}
