import type { ArtifactKind } from "@/lib/ipc";
import type { FilterChip } from "./Setup.types";

/**
 * The order artifact kinds are presented in — configuration first (rules), then
 * the things an agent invokes, then the plumbing. Matches the `ArtifactKind`
 * union's declaration order in the generated bindings.
 */
export const KIND_ORDER: readonly ArtifactKind[] = [
  "rule",
  "skill",
  "agent",
  "command",
  "hook",
  "mcp_server",
  "plugin",
  "settings",
] as const;

/** An artifact whose invocations fail this often is worth a second look. */
export const ERROR_RATE_THRESHOLD = 0.25;

/**
 * "High cost" is relative, not absolute: an artifact costs a lot when its
 * average turn burns at least twice what the typical measured artifact burns.
 */
export const COST_MEDIAN_MULTIPLIER = 2;

/** Fewest measured artifacts a median needs before "high cost" means anything. */
export const MIN_COST_SAMPLES = 2;

/** The filter chips above the inventory, in display order. */
export const FILTER_CHIPS: readonly FilterChip[] = [
  { id: "all", label: "All" },
  { id: "never", label: "Never used" },
  { id: "errors", label: "Errors" },
  { id: "cost", label: "High cost" },
] as const;
