/** What kind of rule a row is, as the sheet names it. */
export const RULE_TYPE = {
  nl: "AI standard",
  pattern: "Pattern rule",
  builtin: "Built-in",
} as const;

/** The heading over a rule's text: what an NL rule asks, or what a pattern rule forbids. */
export const TEXT_HEADING = { nl: "Instruction", pattern: "Pattern" } as const;
