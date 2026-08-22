import type { EffectiveRule, ProjectSetup } from "@/lib/ipc";
import type { Navigate } from "@/App/App.types";
import type { SetupFilter } from "../setup.util";

/**
 * A project's rule stack, or the sentinel for a lookup that failed. An empty
 * array means "nothing applies here" — a real, different answer — so the two
 * cannot share a representation.
 */
export type EffectiveRules = EffectiveRule[] | "error";

export interface ProjectRowProps {
  project: ProjectSetup;
  filter: SetupFilter;
  /** The whole setup's cost bar, passed straight through to the artifact blocks. */
  costBar: number | null;
  /** Lazily loads (and memoises) this project's rule stack. */
  effectiveRulesFor: (harness: string, projectPath: string) => Promise<EffectiveRules>;
  /** Changes when the memoised stacks are dropped; forces an open row to reload. */
  rulesVersion: number;
  navigate: Navigate;
}

export interface RuleLinkProps {
  rule: EffectiveRule;
  navigate: Navigate;
}
