import type { ArtifactKind } from "@/lib/ipc";

/** One artifact's kind, singular, as the sheet names it. */
export const KIND_NAME: Record<ArtifactKind, string> = {
  rule: "Rule",
  skill: "Skill",
  agent: "Agent",
  command: "Command",
  hook: "Hook",
  mcp_server: "MCP server",
  plugin: "Plugin",
  settings: "Settings file",
};

/** The kinds the usage index can attribute an invocation to. */
export const INVOKED_KINDS: ReadonlySet<ArtifactKind> = new Set(["skill", "agent", "command", "mcp_server"]);
