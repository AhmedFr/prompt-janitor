import type { Severity } from "@/lib/ipc";
import type { RuleDraft, RuleKind } from "./RulesNew.types";

export const SCREEN_TITLE = "New rule";

/** The toolbar's back arrow — it abandons the flow, so it is named for where it lands. */
export const BACK_TO_RULES_LABEL = "Back to rules";

/** Where Cancel goes when the flow was reached without a tab to return to. */
export const DEFAULT_TAB = "builtin";

/* ---- step 1: which kind ---- */

export const STEP_TYPE_TITLE = "What kind of rule?";
export const STEP_TYPE_BLURB =
  "Both run on every file you scan. The difference is who decides: your text, or your model.";

export const KIND_TITLE: Record<RuleKind, string> = {
  pattern: "Pattern rule",
  nl: "Natural-language standard",
};

export const KIND_BLURB: Record<RuleKind, string> = {
  pattern:
    "Flags any file containing a piece of text you name. Deterministic, instant, and free — no provider involved.",
  nl: "Describe the standard in a sentence and your AI provider judges each file against it.",
};

/**
 * What the natural-language card is waiting on. Gated on a configured
 * provider only: monetisation is paused, so a licence never decides what this
 * flow offers.
 */
export const NL_HINT =
  "Connect an AI provider in Settings → AI and natural-language standards become available.";

/** Ties the disabled card to the sentence explaining it. */
export const NL_HINT_ID = "rules-new-nl-hint";

/** Field ids. One form on screen at a time, so plain ids are unambiguous. */
export const TITLE_ID = "rules-new-title";
export const BODY_ID = "rules-new-body";
export const BODY_HINT_ID = "rules-new-body-hint";

/* ---- step 2: the form ---- */

export const FORM_TITLE: Record<RuleKind, string> = {
  pattern: "New pattern rule",
  nl: "New natural-language standard",
};

export const TITLE_LABEL = "Rule name";
export const TITLE_PLACEHOLDER = "e.g. Never reference Slack";

export const BODY_LABEL: Record<RuleKind, string> = {
  pattern: "Forbidden text",
  nl: "Instruction",
};

export const BODY_PLACEHOLDER: Record<RuleKind, string> = {
  pattern: "e.g. slack",
  nl: "e.g. Must define an explicit output format",
};

export const BODY_HINT: Record<RuleKind, string> = {
  pattern: "Matched anywhere in the file, and flagged wherever it appears.",
  nl: "Evaluated by your AI provider when you check a file on its detail page.",
};

export const SEVERITY_LABEL = "Severity";

/** Worst first, the way every severity list in the app reads. */
export const SEVERITIES: { value: Severity; label: string }[] = [
  { value: "hi", label: "Critical" },
  { value: "mid", label: "Warning" },
  { value: "lo", label: "Nit" },
];

/** A new rule is a warning until its author says otherwise. */
export const DEFAULT_SEVERITY: Severity = "mid";

export const EMPTY_DRAFT: RuleDraft = { title: "", body: "", severity: DEFAULT_SEVERITY };

export const CHANGE_TYPE_LABEL = "Change type";
export const CANCEL_LABEL = "Cancel";
export const SAVE_LABEL = "Save rule";
export const SAVING_LABEL = "Saving…";

/**
 * The write did not land. Almost always a scan holding the database, which is
 * why the form stays exactly as typed — the only thing to do is try again.
 */
export const SAVE_FAILED = "Could not save that rule — try again.";
