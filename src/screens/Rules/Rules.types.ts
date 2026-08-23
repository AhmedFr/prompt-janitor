import type { RuleInfo } from "@/lib/ipc";
import type { Navigate } from "@/App/App.types";

/**
 * Which table a rule belongs to. Disjoint and exhaustive over `RuleInfo`
 * (see `tabOf`): a natural-language rule is an AI standard whether or not
 * the user wrote it, so `nl` is checked before `custom`.
 */
export type RuleTabId = "builtin" | "custom" | "ai";

export interface RulesProps {
  navigate: Navigate;
  /**
   * The tab to open on — `/rules/new` sends the user back to the tab their
   * new rule landed in. Beats whatever tab was last remembered.
   */
  initialTab?: string;
  /** Override the live rule set (Storybook only); the hook supplies it in the app. */
  rules?: RuleInfo[];
}

/** What {@link useRules} hands the screen. */
export interface RulesState {
  rules: RuleInfo[];
  loading: boolean;
  /** The query failed — distinct from "there are no rules", which never happens. */
  failed: boolean;
  /**
   * The last mutation that did not land, as a sentence to show. Cleared by the
   * next one that does. Not the same thing as {@link RulesState.failed}, which
   * is about the *read* and replaces the whole screen.
   */
  error: string | null;
  /** A provider and key are configured, so natural-language standards can actually run. */
  aiReady: boolean;
  /** None of these reject — each owns its failure and reports it through `error`. */
  toggle: (id: string, enabled: boolean) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  /** How many rules the chosen pack added; 0 if the picker was dismissed or the import failed. */
  importPack: () => Promise<number>;
  refetch: () => Promise<void>;
}
