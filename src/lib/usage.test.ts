import { describe, it, expect } from "vitest";
import { KIND_LABEL, KIND_OPTIONS, SETUP_TAB_FOR_KIND, USAGE_KINDS, rankedKey } from "./usage";

describe("USAGE_KINDS", () => {
  it("lists every invocation kind in the bindings' own order", () => {
    expect(USAGE_KINDS).toEqual(["skill", "agent", "mcp", "builtin"]);
  });
});

describe("KIND_LABEL", () => {
  it("names all four invocation kinds", () => {
    expect(KIND_LABEL.skill).toBe("Skills");
    expect(KIND_LABEL.agent).toBe("Agents");
    expect(KIND_LABEL.mcp).toBe("MCP");
    expect(KIND_LABEL.builtin).toBe("Built-in");
  });
});

describe("KIND_OPTIONS", () => {
  it("is the selector chip set, one chip per kind, in kind order", () => {
    expect(KIND_OPTIONS).toEqual([
      { id: "skill", label: "Skills" },
      { id: "agent", label: "Agents" },
      { id: "mcp", label: "MCP" },
      { id: "builtin", label: "Built-in" },
    ]);
  });
});

describe("rankedKey", () => {
  it("keys by kind and target, so a skill and an agent of one name stay apart", () => {
    expect(rankedKey({ kind: "skill", target: "adapt" })).toBe("skill:adapt");
    expect(rankedKey({ kind: "agent", target: "adapt" })).toBe("agent:adapt");
  });
});

describe("SETUP_TAB_FOR_KIND", () => {
  it("maps an invocation kind to the Setup tab that holds it", () => {
    expect(SETUP_TAB_FOR_KIND.skill).toBe("skill");
    expect(SETUP_TAB_FOR_KIND.agent).toBe("agent");
    expect(SETUP_TAB_FOR_KIND.mcp).toBe("mcp_server");
  });

  it("has no Setup tab for built-in tools — nothing installed them", () => {
    // Built-ins ship with the harness, so there is no inventory row to open.
    expect(SETUP_TAB_FOR_KIND.builtin).toBeNull();
  });
});
