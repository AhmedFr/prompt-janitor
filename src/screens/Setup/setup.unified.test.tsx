import { describe, expect, it } from "vitest";
import type { SetupRow } from "@/lib/setupRows";
import { unifiedColumns, visibleColumnIds } from "./setup.unified";

const row = (over: Partial<SetupRow>): SetupRow => ({
  id: 1, harness: "claude_code", layer: "global", kind: "skill", name: "x", path: "/x", plugin_name: null,
  description: null, bytes: 400, grade: null, score: null, file_id: null, usage: null, issue_count: null,
  worst_severity: null, origin: "inventory", project_label: null, project_path: null, load_order: null, ...over,
});

describe("visibleColumnIds", () => {
  it("shows Kind only on the All chip", () => {
    expect(visibleColumnIds("all", [row({})], false)).toContain("kind");
    expect(visibleColumnIds("skill", [row({})], false)).not.toContain("kind");
  });

  it("hides usage columns when no row in the slice can have usage", () => {
    const ids = visibleColumnIds("settings", [row({ kind: "settings" })], false);
    expect(ids).not.toContain("uses");
    expect(ids).not.toContain("errorRate");
    expect(ids).not.toContain("lastUsed");
  });

  it("keeps Findings whenever an instruction is in the slice", () => {
    expect(visibleColumnIds("all", [row({ kind: "rule" })], false)).toContain("findings");
    expect(visibleColumnIds("skill", [row({})], false)).not.toContain("findings");
  });

  it("adds the load-order column only under the lens, and only when instructions are shown", () => {
    expect(visibleColumnIds("all", [row({ kind: "rule" })], true)[0]).toBe("order");
    expect(visibleColumnIds("all", [row({ kind: "rule" })], false)).not.toContain("order");
    expect(visibleColumnIds("skill", [row({})], true)).not.toContain("order");
  });

  it("always has Name and Scope", () => {
    for (const k of ["all", "rule", "hook", "plugin"] as const) {
      const ids = visibleColumnIds(k, [row({ kind: k === "all" ? "skill" : k })], false);
      expect(ids).toEqual(expect.arrayContaining(["name", "scope"]));
    }
  });

  it("hides Tokens when no row in the slice can fill it (spec §4.4)", () => {
    expect(visibleColumnIds("hook", [row({ kind: "hook" })], false)).not.toContain("tokens");
    expect(visibleColumnIds("plugin", [row({ kind: "plugin" })], false)).not.toContain("tokens");
    expect(visibleColumnIds("settings", [row({ kind: "settings" })], false)).not.toContain("tokens");
    // a skill with no measured usage has no tokens either
    expect(visibleColumnIds("skill", [row({ usage: null })], false)).not.toContain("tokens");
  });

  it("shows Tokens once one row has a size-based estimate or measured usage", () => {
    expect(visibleColumnIds("rule", [row({ kind: "rule", bytes: 4000 })], false)).toContain("tokens");
    const used = row({ usage: { avg_turn_tokens: 7300 } as SetupRow["usage"] });
    expect(visibleColumnIds("all", [row({ kind: "hook" }), used], false)).toContain("tokens");
  });
});

describe("unifiedColumns", () => {
  it("returns the same array for the same ctx and ids", () => {
    const ctx = { onOpen: () => {}, projectNames: new Map() };
    const ids = ["name", "scope"];
    expect(unifiedColumns(ids, ctx)).toBe(unifiedColumns(["name", "scope"], ctx));
  });

  it("estimates an instruction's tokens from its size", () => {
    const ctx = { onOpen: () => {}, projectNames: new Map() };
    const tokens = unifiedColumns(["tokens"], ctx)[0];
    const accessor = (tokens as unknown as { accessorFn: (r: SetupRow) => number }).accessorFn;
    expect(accessor(row({ kind: "rule", bytes: 4000 }))).toBe(1000);
    expect(accessor(row({ kind: "skill", usage: { avg_turn_tokens: 7300 } as SetupRow["usage"] }))).toBe(7300);
  });
});
