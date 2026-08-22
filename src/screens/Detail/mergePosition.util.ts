import type { ArtifactKind, ArtifactView, EffectiveRule, ProjectSetup } from "@/lib/ipc";
import type { MergeLayer } from "./MergePosition/MergePosition.types";

/**
 * Kinds a prompt can summon by writing their name. Rules load by position, not
 * by mention — they already have their own list — and settings/hooks are never
 * addressed by name at all, so naming them in prose means nothing.
 */
const REFERENCEABLE_KINDS: readonly ArtifactKind[] = [
  "skill",
  "agent",
  "command",
  "mcp_server",
  "plugin",
];

const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;
const WORD_CHAR = /\w/;

/**
 * Whether `content` names `name` as a standalone word.
 *
 * `\b` only asserts a boundary next to a word character, so a name that starts
 * or ends in punctuation (`c++`) gets that side left unanchored rather than
 * anchored to a boundary it can never satisfy. Because `/` is not a word
 * character, the same pattern already accepts the `/name` form a command or
 * skill is usually invoked with.
 */
function mentionsName(content: string, name: string): boolean {
  if (!name) return false;
  const lead = WORD_CHAR.test(name[0]) ? "\\b" : "";
  const tail = WORD_CHAR.test(name[name.length - 1]) ? "\\b" : "";
  return new RegExp(`${lead}${name.replace(REGEX_SPECIAL, "\\$&")}${tail}`).test(content);
}

/**
 * The artifacts a file actually names in its text.
 *
 * Matching is case-sensitive: these names are invoked verbatim by the harness,
 * so "Adapt" at the start of a sentence is English, not a call.
 */
export function referencedArtifacts(content: string, candidates: ArtifactView[]): ArtifactView[] {
  return candidates.filter((a) => mentionsName(content, a.name));
}

/**
 * Everything the viewed file could plausibly name: the invocable artifacts that
 * apply everywhere plus the ones its own project installs, minus the file
 * itself — a skill's own SKILL.md always contains its name, and reporting that
 * as a reference would tell the reader nothing.
 */
export function referenceCandidates(
  globals: ArtifactView[],
  project: ProjectSetup | null,
  filePath: string,
): ArtifactView[] {
  return [...globals, ...(project?.artifacts ?? [])].filter(
    (a) => a.path !== filePath && REFERENCEABLE_KINDS.includes(a.kind),
  );
}

/** `path` without any trailing slashes, so `/repo/` and `/repo` compare equal. */
const root = (path: string) => path.replace(/\/+$/, "");

/**
 * The project whose stack a file loads into: the one with the longest path that
 * contains it. Longest wins so a file inside a nested project resolves to that
 * project rather than to whichever enclosing root happened to be listed first.
 * The `/` in the prefix test keeps `/repository` from matching `/repo`.
 */
export function projectForPath(
  filePath: string,
  projects: ProjectSetup[],
): ProjectSetup | null {
  let best: ProjectSetup | null = null;
  let bestLength = -1;
  for (const project of projects) {
    const base = root(project.path);
    if (filePath !== base && !filePath.startsWith(`${base}/`)) continue;
    if (base.length > bestLength) {
      best = project;
      bestLength = base.length;
    }
  }
  return best;
}

/**
 * Which layer the viewed file itself lives in. It is global only when it *is*
 * one of the global rule files; a global skill or agent is an artifact that
 * applies everywhere, not a rule in the merge order.
 */
export function layerForPath(filePath: string, globals: ArtifactView[]): MergeLayer {
  return globals.some((a) => a.kind === "rule" && a.path === filePath) ? "global" : "project";
}

/**
 * The stack for a file that *is* a global rule. `get_effective_rules` answers
 * per project, so it has nothing to say here; the honest answer is the other
 * global rules of the same harness, which load alongside this one everywhere.
 * Empty when `filePath` is not a global artifact at all.
 */
export function globalRuleStack(filePath: string, globals: ArtifactView[]): EffectiveRule[] {
  const self = globals.find((a) => a.path === filePath);
  if (!self) return [];
  return globals
    .filter((a) => a.kind === "rule" && a.harness === self.harness)
    .map((a) => ({
      layer: a.layer,
      path: a.path,
      name: a.name,
      grade: a.grade,
      file_id: a.file_id,
    }));
}
