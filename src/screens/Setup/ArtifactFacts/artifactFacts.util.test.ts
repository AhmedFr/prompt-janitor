import { describe, it, expect, vi, afterEach } from "vitest";
import type { ArtifactView } from "@/lib/ipc";
import { factsFor } from "./artifactFacts.util";

const row = (over: Partial<ArtifactView> = {}): ArtifactView => ({
  id: 1,
  harness: "claude_code",
  layer: "global",
  kind: "mcp_server",
  name: "posthog",
  path: "/Users/a/.claude.json",
  plugin_name: null,
  description: null,
  bytes: 10,
  grade: null,
  score: null,
  file_id: null,
  usage: null,
  ...over,
});

afterEach(() => vi.useRealTimers());

describe("factsFor", () => {
  it("always says what kind of thing it is and where it comes from", () => {
    expect(factsFor(row(), "Global")).toEqual([
      ["Kind", "MCP server"],
      ["Scope", "Global"],
      ["Last used", "never"],
    ]);
  });

  it("includes the description unless the file already shows it", () => {
    const r = row({ kind: "agent", description: "Reviews code" });
    expect(factsFor(r, "Global")).toContainEqual(["Description", "Reviews code"]);
    expect(factsFor(r, "Global", { showDescription: false }).map(([k]) => k)).not.toContain("Description");
  });

  it("spells out usage when anything ever invoked it", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-24T12:00:00Z"));
    const r = row({
      usage: {
        total: 1234,
        sessions: 12,
        last_used: "2026-09-21T12:00:00Z",
        error_rate: 0.083,
        avg_turn_tokens: 5400,
        count_30d: 10,
        count_prev_30d: 4,
      },
    });
    expect(factsFor(r, "Global")).toEqual([
      ["Kind", "MCP server"],
      ["Scope", "Global"],
      ["Uses", "1,234 in 12 sessions"],
      ["Error rate", "8%"],
      ["Avg tokens per turn", "5,400"],
      ["Last used", "3d ago"],
    ]);
  });

  it("leaves out rates nobody measured instead of printing a dash", () => {
    const r = row({
      usage: {
        total: 2,
        sessions: 1,
        last_used: null,
        error_rate: null,
        avg_turn_tokens: null,
        count_30d: 0,
        count_prev_30d: 0,
      },
    });
    const keys = factsFor(r, "Global").map(([k]) => k);
    expect(keys).not.toContain("Error rate");
    expect(keys).not.toContain("Avg tokens per turn");
  });

  it("says nothing about usage for kinds that are never invoked", () => {
    expect(factsFor(row({ kind: "settings" }), "Global").map(([k]) => k)).toEqual(["Kind", "Scope"]);
  });

  it("shows a grade with its score when the grader saw the file", () => {
    expect(factsFor(row({ kind: "rule", grade: "B", score: 78 }), "Global")).toContainEqual(["Grade", "B · 78"]);
  });
});
