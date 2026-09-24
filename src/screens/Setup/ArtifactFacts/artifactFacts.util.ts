import { formatCount, formatPercent, formatTokens, lastUsedAt, NEVER_MARK } from "@/components/DataTable";
import { relativeTime } from "@/lib/format";
import type { ArtifactView } from "@/lib/ipc";
import { INVOKED_KINDS, KIND_NAME } from "./ArtifactFacts.constants";
import type { Fact, FactsOptions } from "./ArtifactFacts.types";

/**
 * The label/value pairs the sheet lists above an artifact's source. A fact
 * nobody measured is left out rather than printed as a dash: the table needs
 * a dash to keep its columns aligned, a list of facts does not.
 */
export function factsFor(artifact: ArtifactView, scope: string, { showDescription = true }: FactsOptions = {}): Fact[] {
  const facts: Fact[] = [
    ["Kind", KIND_NAME[artifact.kind]],
    ["Scope", scope],
  ];
  if (showDescription && artifact.description) facts.push(["Description", artifact.description]);
  if (artifact.grade) {
    facts.push(["Grade", artifact.score == null ? artifact.grade : `${artifact.grade} · ${artifact.score}`]);
  }

  const usage = artifact.usage;
  if (usage) {
    facts.push(["Uses", `${formatCount(usage.total)} in ${formatCount(usage.sessions)} sessions`]);
    if (usage.error_rate != null) facts.push(["Error rate", formatPercent(usage.error_rate)]);
    if (usage.avg_turn_tokens != null) facts.push(["Avg tokens per turn", formatTokens(usage.avg_turn_tokens)]);
  }
  if (usage || INVOKED_KINDS.has(artifact.kind)) facts.push(["Last used", lastUsedLabel(usage?.last_used)]);
  return facts;
}

/** "3d ago", or "never" for an artifact nothing ever invoked. */
function lastUsedLabel(lastUsed: string | null | undefined): string {
  const at = lastUsedAt(lastUsed);
  if (at === null) return NEVER_MARK;
  const age = relativeTime(String(Math.floor(at / 1000)));
  return age === "now" ? "just now" : `${age} ago`;
}
