import type { Severity } from "@/lib/ipc";
import type { Navigate } from "@/App/App.types";

/**
 * Which kind of rule is being written. Deliberately not `RuleTabId`: the AI
 * tab holds built-in standards too, and this is only about what the user is
 * about to create.
 */
export type RuleKind = "pattern" | "nl";

export interface RulesNewProps {
  navigate: Navigate;
  /**
   * The Rules tab the user pressed **Add rule** on (`builtin` | `custom` |
   * `ai`). Cancelling returns there, and `ai` opens straight into the
   * natural-language form — the user already said which kind they wanted.
   */
  initialType?: string;
  /**
   * Override the AI-provider check (Storybook only); the hook reads
   * `get_ai_config` in the app. `null` means "not known yet".
   */
  aiReady?: boolean | null;
}

/**
 * The rule being written. One `body` field for both kinds — a pattern rule's
 * forbidden substring and a standard's instruction are stored in the same
 * column (`custom_rules.expr`) and only differ in what they are called.
 */
export interface RuleDraft {
  title: string;
  body: string;
  severity: Severity;
}

/** What {@link useRulesNew} hands the screen. */
export interface RulesNewState {
  /** `null` while the type step is still asking. */
  kind: RuleKind | null;
  draft: RuleDraft;
  /**
   * A provider and key are configured, so natural-language standards can
   * actually run. `null` until the check lands — unknown is not the same as
   * "no provider", and disabling on unknown would flash a gate at everyone.
   */
  aiReady: boolean | null;
  /** A save is in flight; a second one must not start behind it. */
  saving: boolean;
  /** The save that did not land, as a sentence to show. Cleared by the next attempt. */
  error: string | null;
  choose: (kind: RuleKind) => void;
  /** Back to the type step, keeping what has been typed. */
  back: () => void;
  update: (patch: Partial<RuleDraft>) => void;
  /** Leave without saving, landing on the tab this flow was opened from. */
  cancel: () => void;
  /** Never rejects: a failed write reports itself through {@link RulesNewState.error}. */
  save: () => Promise<void>;
}
