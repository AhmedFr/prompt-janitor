import type { ReactNode } from "react";

export interface SheetProps {
  /** The heading, and the dialog's accessible name unless `ariaLabel` overrides it. */
  title: string;
  /** For when the title alone does not say what is open ("posthog — MCP server"). */
  ariaLabel?: string;
  /**
   * Every way out goes through here — the close button, Escape, a press on the
   * backdrop — so a caller holding a draft has one place to intercept.
   */
  onClose: () => void;
  /** A line under the title: what kind of thing this is, where it comes from. */
  subtitle?: ReactNode;
  /** A row between the header and the body (the file's path, usually). */
  toolbar?: ReactNode;
  /** What went wrong, pinned above the footer as an alert. Nothing when absent. */
  error?: string | null;
  footer?: ReactNode;
  /** Laid over the whole panel, such as a confirm. */
  overlay?: ReactNode;
  /** The scrollable body. */
  children: ReactNode;
}

export interface SheetPathProps {
  /** Absolute path on disk. */
  path: string;
  /** What the Open button's accessible name says it opens. */
  name: string;
}
