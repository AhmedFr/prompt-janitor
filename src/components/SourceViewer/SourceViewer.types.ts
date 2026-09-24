import type { SourceFormat } from "@/lib/ipc";

/** A markdown file's `---` header, split from its body for the read view. */
export interface Frontmatter {
  /** `key: value` pairs in file order; scalars only (see `splitFrontmatter`). */
  fields: [string, string][];
  /** Everything after the closing fence — the markdown the viewer renders. */
  body: string;
}

export interface SourceViewerProps {
  /** The file (or excerpt) exactly as read. */
  content: string;
  /** Markdown is rendered; JSON and text are drawn verbatim in monospace. */
  format: SourceFormat;
  /** What a markdown file with a header and no body reads as. */
  emptyBody?: string;
}
