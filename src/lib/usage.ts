import type { ArtifactKind, InvocationKind, RankedTarget } from "@/lib/ipc";

/**
 * Shared vocabulary for the two places that rank harness invocations — the
 * Analytics → Usage tab and a project page's Usage tab. Both build the same
 * selector out of the same kinds, and both key rows the same way, so the
 * labels live here rather than in whichever screen defined them first.
 */

/** The invocation kinds the usage selectors offer, in `InvocationKind`'s own order. */
export const USAGE_KINDS: readonly InvocationKind[] = ["skill", "agent", "mcp", "builtin"] as const;

/** Invocation kind → the label the UI shows for it. */
export const KIND_LABEL: Record<InvocationKind, string> = {
  skill: "Skills",
  agent: "Agents",
  mcp: "MCP",
  builtin: "Built-in",
};

/** The selector chips, built once — the kinds never change. */
export const KIND_OPTIONS: { id: InvocationKind; label: string }[] = USAGE_KINDS.map((kind) => ({
  id: kind,
  label: KIND_LABEL[kind],
}));

/**
 * The key for a ranked row. Usage is grouped by `(kind, target)`, so a skill
 * and an agent may share a target name and must stay separate rows.
 */
export function rankedKey(row: Pick<RankedTarget, "kind" | "target">): string {
  return `${row.kind}:${row.target}`;
}

/**
 * Which Setup tab holds the artifacts of an invocation kind — the tab a
 * ranked row's "Details" link opens.
 *
 * `builtin` has none: built-in tools ship with the harness, so there is no
 * inventory row to open and the link is left off rather than pointed at a
 * tab that cannot answer for them.
 */
export const SETUP_TAB_FOR_KIND: Record<InvocationKind, ArtifactKind | null> = {
  skill: "skill",
  agent: "agent",
  mcp: "mcp_server",
  builtin: null,
};
