import type { ProviderMeta } from "./ProviderIcon.types";

const claudeSpark = (
  <path d="M12 3l1.9 5.2L19 10l-5.1 1.8L12 17l-1.9-5.2L5 10l5.1-1.8z" fill="#fff" stroke="none" />
);
const robot = (
  <>
    <rect x="5" y="8" width="14" height="10" rx="3" fill="#fff" stroke="none" />
    <circle cx="9.5" cy="13" r="1.4" fill="#111" stroke="none" />
    <circle cx="14.5" cy="13" r="1.4" fill="#111" stroke="none" />
    <line x1="12" y1="4.5" x2="12" y2="8" stroke="#fff" strokeWidth="1.6" />
  </>
);
const cursor = (
  <path d="M7 5l11 6-4.6 1.4L11 18z" fill="#fff" stroke="none" />
);
const gemini = (
  <path d="M12 4c.6 4 2 5.4 6 6-4 .6-5.4 2-6 6-.6-4-2-5.4-6-6 4-.6 5.4-2 6-6z" fill="#fff" stroke="none" />
);
const fileGlyph = (
  <path d="M7 4h7l4 4v12H7z" fill="none" stroke="#fff" strokeWidth="1.7" />
);

export const PROVIDERS: Record<string, ProviderMeta> = {
  "CLAUDE.md": { label: "Claude", bg: "#c96442", glyph: claudeSpark },
  "AGENTS.md": { label: "Agents", bg: "#1c1c1e", glyph: robot },
  "GEMINI.md": { label: "Gemini", bg: "#3186ff", glyph: gemini },
  ".cursorrules": { label: "Cursor", bg: "#0a84ff", glyph: cursor },
  "cursor-rule": { label: "Cursor", bg: "#0a84ff", glyph: cursor },
  ".windsurfrules": { label: "Windsurf", bg: "#0aa37f", glyph: fileGlyph },
  ".clinerules": { label: "Cline", bg: "#5b5bd6", glyph: fileGlyph },
  ".continuerules": { label: "Continue", bg: "#111827", glyph: fileGlyph },
  "copilot-instructions.md": { label: "Copilot", bg: "#24292f", glyph: fileGlyph },
};

export const FALLBACK_PROVIDER: ProviderMeta = { label: "File", bg: "#8e8e93", glyph: fileGlyph };
