import type { RuleInfo } from "@/lib/ipc";

/**
 * Which table a rule belongs to. Disjoint and exhaustive over `RuleInfo`
 * (see `tabOf`): a natural-language rule is an AI check whether or not
 * the user wrote it, so `nl` is checked before `custom`.
 */
export type RuleTabId = "builtin" | "custom" | "ai";

export interface ChecksLibraryProps {
  /**
   * The tab to open on — the add-check form sends the user back to the tab
   * their new check landed in. Beats whatever tab was last remembered.
   */
  initialTab?: string;
  /** Override the live rule set (Storybook only); the hook supplies it in the app. */
  rules?: RuleInfo[];
  /** Opens the add-check form, carrying the tab it was pressed on. */
  onAdd: (tab: RuleTabId) => void;
}

/** What {@link useChecksLibrary} hands the screen. */
export interface RulesState {
  rules: RuleInfo[];
  loading: boolean;
  /** The query failed — distinct from "there are no rules", which never happens. */
  failed: boolean;
  /**
   * Running outside the Tauri runtime, so there is nothing to read and
   * nothing to write. Distinct from {@link RulesState.failed}: no query has
   * failed, there is simply no desktop app behind this window.
   */
  unavailable: boolean;
  /** A provider and key are configured, so natural-language standards can actually run. */
  aiReady: boolean;
  /**
   * None of these reject — each owns its failure and reports it through the
   * `say` the hook was built with, so it expires like every other message.
   */
  toggle: (id: string, enabled: boolean) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  /** How many rules the chosen pack added; 0 if the picker was dismissed or the import failed. */
  importPack: () => Promise<number>;
  refetch: () => Promise<void>;
}
