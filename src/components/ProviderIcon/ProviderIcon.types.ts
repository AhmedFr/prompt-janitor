import type React from "react";

export interface ProviderIconProps {
  /** File kind from the scan (e.g. "CLAUDE.md", "AGENTS.md", ".cursorrules"). */
  kind: string;
  /** Square size in px. Default 26. */
  size?: number;
}

export interface ProviderMeta {
  label: string;
  /** Background color of the rounded square. */
  bg: string;
  /** White-stroked/filled glyph, drawn on a 24×24 grid. */
  glyph: React.ReactNode;
}
