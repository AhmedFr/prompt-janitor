import { describe, it, expect } from "vitest";
import type { RuleInfo } from "@/lib/ipc";
import { canSave, newRuleId, ruleStamp } from "./rulesNew.util";

const rule = (o: Partial<RuleInfo> = {}): RuleInfo => ({
  id: "r1",
  title: "rule",
  description: "",
  source: "custom",
  severity: "mid",
  enabled: true,
  custom: true,
  nl: false,
  pattern: "x",
  hit_count: 0,
  ...o,
});

describe("ruleStamp", () => {
  it("reads the nanosecond stamp out of a pattern rule's id", () => {
    expect(ruleStamp("custom-1755900000000000000")).toBe(1755900000000000000);
  });

  it("reads it out of a natural-language rule's id too", () => {
    expect(ruleStamp("custom-nl-42")).toBe(42);
  });

  it("is -1 for an id it cannot read, so a real stamp always outranks it", () => {
    expect(ruleStamp("no-slack")).toBe(-1);
    expect(ruleStamp("custom-")).toBe(-1);
  });
});

describe("newRuleId", () => {
  const rows = [
    rule({ id: "b1", title: "Never say synergy", custom: false, source: "anthropic" }),
    rule({ id: "custom-100", title: "Never say synergy" }),
    rule({ id: "custom-300", title: "Never say synergy" }),
    rule({ id: "custom-200", title: "Something else" }),
    rule({ id: "custom-nl-400", title: "Never say synergy", nl: true }),
  ];

  it("picks the newest custom rule with that title and kind", () => {
    expect(newRuleId(rows, "Never say synergy", false)).toBe("custom-300");
  });

  it("keeps pattern rules and natural-language standards apart", () => {
    expect(newRuleId(rows, "Never say synergy", true)).toBe("custom-nl-400");
  });

  it("never returns a built-in rule that happens to share the title", () => {
    expect(newRuleId([rows[0]], "Never say synergy", false)).toBeUndefined();
  });

  it("matches the title as the user typed it, trimmed", () => {
    expect(newRuleId(rows, "  Never say synergy  ", false)).toBe("custom-300");
  });

  it("is undefined when nothing matches, so the trip loses its highlight and nothing else", () => {
    expect(newRuleId(rows, "Not a rule", false)).toBeUndefined();
    expect(newRuleId([], "Never say synergy", false)).toBeUndefined();
  });

  it("falls back to the last match when no id carries a stamp", () => {
    const odd = [rule({ id: "legacy-a", title: "T" }), rule({ id: "legacy-b", title: "T" })];
    expect(newRuleId(odd, "T", false)).toBe("legacy-b");
  });
});

describe("canSave", () => {
  const draft = { title: "Never say synergy", body: "synergy", severity: "mid" as const };

  it("needs both fields", () => {
    expect(canSave("pattern", draft, true)).toBe(true);
    expect(canSave("pattern", { ...draft, title: "   " }, true)).toBe(false);
    expect(canSave("pattern", { ...draft, body: "" }, true)).toBe(false);
  });

  it("lets a pattern rule save with no AI provider — it never needed one", () => {
    expect(canSave("pattern", draft, false)).toBe(true);
  });

  it("holds a natural-language standard back until a provider is known to be there", () => {
    expect(canSave("nl", draft, false)).toBe(false);
    expect(canSave("nl", draft, true)).toBe(true);
  });

  it("treats an unfinished provider check as no obstacle", () => {
    expect(canSave("nl", draft, null)).toBe(true);
  });
});
