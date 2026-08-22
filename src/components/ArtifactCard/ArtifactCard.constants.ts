import type { ArtifactKind } from "@/lib/ipc";
import type { IconName } from "@/components/Icon";

/** Glyph per artifact kind. Reuses existing icons rather than adding new SVGs. */
export const KIND_ICON: Record<ArtifactKind, IconName> = {
  rule: "rules",
  skill: "sparkles",
  agent: "wand",
  command: "chevronRight",
  hook: "refresh",
  mcp_server: "dashboard",
  plugin: "plus",
  settings: "settings",
};

/** Human label per artifact kind, shown in the card's kind chip. */
export const KIND_LABEL: Record<ArtifactKind, string> = {
  rule: "Rule",
  skill: "Skill",
  agent: "Agent",
  command: "Command",
  hook: "Hook",
  mcp_server: "MCP Server",
  plugin: "Plugin",
  settings: "Settings",
};
