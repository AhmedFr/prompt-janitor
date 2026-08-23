import type { RuleInfo } from "@/lib/ipc";
import type { RuleDraft, RuleKind } from "./RulesNew.types";

/**
 * Custom rule ids are minted as `custom-{nanos}` / `custom-nl-{nanos}`
 * (`src-tauri/src/query.rs`), so the id itself carries the creation time.
 */
const STAMPED = /^custom-(?:nl-)?(\d+)$/;

/**
 * The nanosecond stamp inside a custom rule's id, or `-1` for an id that does
 * not carry one — which makes any real stamp outrank it under `>=`.
 */
export function ruleStamp(id: string): number {
  const match = STAMPED.exec(id);
  return match ? Number(match[1]) : -1;
}

/**
 * The id of the rule that was just written, found by asking for the list
 * again. `add_custom_rule`/`add_nl_rule` mint the id but the IPC binding
 * returns `null`, and changing that signature is a separate job — so the
 * newest custom rule of the right kind carrying the title we just sent is the
 * best answer available, and it is exact in every case a human can produce:
 * two rules of the same kind and title created in the same nanosecond.
 *
 * `undefined` when nothing matches. The trip then loses its highlight and
 * nothing else — the rule is still saved, and the tab is still right.
 */
export function newRuleId(rules: RuleInfo[], title: string, nl: boolean): string | undefined {
  const wanted = title.trim();
  let best: string | undefined;
  let bestStamp = -Infinity;

  for (const rule of rules) {
    if (!rule.custom || rule.nl !== nl || rule.title.trim() !== wanted) continue;
    const stamp = ruleStamp(rule.id);
    // `>=` so that with no stamps to compare (an id shape we don't mint), the
    // last match wins — later rows are the later inserts.
    if (stamp >= bestStamp) {
      best = rule.id;
      bestStamp = stamp;
    }
  }

  return best;
}

/**
 * Whether the draft can be written. Both fields are required and trimmed;
 * a natural-language standard additionally needs a provider that is *known*
 * to be there — `null` (the check has not landed) is not an obstacle, because
 * disabling on unknown would flash a gate at everyone who has one configured.
 */
export function canSave(kind: RuleKind, draft: RuleDraft, aiReady: boolean | null): boolean {
  if (!draft.title.trim() || !draft.body.trim()) return false;
  return kind !== "nl" || aiReady !== false;
}
