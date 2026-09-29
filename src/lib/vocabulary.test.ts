import { describe, expect, it } from "vitest";
import { KIND_CHIP_ORDER, KIND_LABEL, KIND_SINGULAR, LABEL } from "./vocabulary";

describe("vocabulary", () => {
  it("names every kind the way the spec's glossary does", () => {
    expect(KIND_LABEL).toEqual({
      rule: "Instructions",
      skill: "Skills",
      agent: "Agents",
      command: "Commands",
      mcp_server: "MCP servers",
      hook: "Hooks",
      plugin: "Plugins",
      settings: "Config",
    });
  });

  it("orders the chips All, Instructions, Skills, Agents, Commands, MCP servers, Hooks, Plugins, Config", () => {
    expect(KIND_CHIP_ORDER).toEqual([
      "all", "rule", "skill", "agent", "command", "mcp_server", "hook", "plugin", "settings",
    ]);
  });

  it("has a singular for the viewer header", () => {
    expect(KIND_SINGULAR.rule).toBe("Instruction file");
    expect(KIND_SINGULAR.settings).toBe("Config file");
    expect(KIND_SINGULAR.mcp_server).toBe("MCP server");
  });

  it("uses one verb for re-indexing and one label for adding a folder", () => {
    expect(LABEL.scan).toBe("Scan");
    expect(LABEL.addFolder).toBe("Add folder…");
    expect(LABEL.checks).toBe("Checks");
    expect(LABEL.aiChecks).toBe("AI checks");
    expect(LABEL.harnessTools).toBe("Harness tools");
  });
});
