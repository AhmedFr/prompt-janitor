import type { ArtifactKind } from "@/lib/ipc";

/**
 * One name per concept (spec §3.3). Every user-visible label for a kind, a
 * verb or a product noun comes from here, so "Rules" can never again mean
 * five different things on five screens. A test pins these strings.
 */

/** What a kind chip filters to: one kind, or everything. */
export type KindFilter = "all" | ArtifactKind;

/** Plural: chip labels, table headers, empty states. */
export const KIND_LABEL: Record<ArtifactKind, string> = {
  rule: "Instructions",
  skill: "Skills",
  agent: "Agents",
  command: "Commands",
  mcp_server: "MCP servers",
  hook: "Hooks",
  plugin: "Plugins",
  settings: "Config",
};

/** Singular: the viewer header's kind, a row's Kind cell. */
export const KIND_SINGULAR: Record<ArtifactKind, string> = {
  rule: "Instruction file",
  skill: "Skill",
  agent: "Agent",
  command: "Command",
  mcp_server: "MCP server",
  hook: "Hook",
  plugin: "Plugin",
  settings: "Config file",
};

/** The order the Setup chips read in (§4.3). */
export const KIND_CHIP_ORDER: readonly KindFilter[] = [
  "all", "rule", "skill", "agent", "command", "mcp_server", "hook", "plugin", "settings",
] as const;

export const LABEL = {
  scan: "Scan",
  scanning: "Scanning…",
  addFolder: "Add folder…",
  all: "All",
  checks: "Checks",
  aiChecks: "AI checks",
  findings: "Findings",
  harnessTools: "Harness tools",
  item: "item",
  items: "items",
} as const;
