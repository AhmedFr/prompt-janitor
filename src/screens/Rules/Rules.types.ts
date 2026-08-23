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
  /** A provider and key are configured, so natural-language standards can actually run. */
  aiReady: boolean;
  /** Paid licence. Read but deliberately not gated on in the UI — monetisation is paused. */
  entitled: boolean;
  toggle: (id: string, enabled: boolean) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  importPack: () => Promise<number>;
  refetch: () => Promise<void>;
}
