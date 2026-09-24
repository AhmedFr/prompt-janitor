import { SOURCES } from "@/components/SourceBadge";
import type { RuleInfo } from "@/lib/ipc";
import { SEVERITY_LABELS } from "../rules.columns";
import { RULE_TYPE } from "./RulePanel.constants";
import type { RuleFact } from "./RulePanel.types";

/** What kind of rule this is: an AI-judged standard, a user's pattern, or one that shipped. */
export function ruleType(rule: Pick<RuleInfo, "nl" | "custom">): string {
  if (rule.nl) return RULE_TYPE.nl;
  return rule.custom ? RULE_TYPE.pattern : RULE_TYPE.builtin;
}

/** The label/value pairs the rule sheet lists above the rule's text. */
export function ruleFacts(rule: RuleInfo): RuleFact[] {
  return [
    ["Source", SOURCES[rule.source].label],
    ["Severity", SEVERITY_LABELS[rule.severity]],
    ["Status", rule.enabled ? "Enabled" : "Disabled"],
    ["Type", ruleType(rule)],
    ["Open issues", String(rule.hit_count)],
  ];
}
