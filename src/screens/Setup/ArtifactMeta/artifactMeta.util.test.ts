import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArtifactView } from "@/lib/ipc";
import { metaSegments } from "./artifactMeta.util";

const row = (over: Partial<ArtifactView> = {}): ArtifactView => ({
  id: 1,
  harness: "claude_code",
  layer: "global",
  kind: "agent",
  name: "code-reviewer",
  path: "/Users/a/.claude/agents/code-reviewer.md",
  plugin_name: null,
  description: null,
  bytes: 10,
  grade: null,
  score: null,
  file_id: null,
  usage: null,
  ...over,
});

const usage = (over: Partial<NonNullable<ArtifactView["usage"]>> = {}) => ({
  total: 312,
  sessions: 18,
  last_used: "2026-09-24T10:00:00Z",
  error_rate: 0.04,
  avg_turn_tokens: 7300,
  count_30d: 40,
  count_prev_30d: 30,
  ...over,
});

const texts = (a: ArtifactView, scope = "web-app") => metaSegments(a, scope).map((s) => s.text);

afterEach(() => vi.useRealTimers());

describe("metaSegments", () => {
  it("leads with what it is and where it comes from", () => {
    expect(texts(row({ kind: "hook" }), "Global")).toEqual(["Hook", "Global"]);
  });

  it("adds uses, the error rate and when it last ran for something invoked", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-24T12:00:00Z"));
    expect(texts(row({ usage: usage() }))).toEqual(["Agent", "web-app", "312 uses", "4% errors", "used 2h ago"]);
  });

  it("says 'use' for one", () => {
    expect(texts(row({ usage: usage({ total: 1, error_rate: null, last_used: null }) }))).toContain("1 use");
  });

  it("tones the error rate by the table's bands", () => {
    const tone = (rate: number) => metaSegments(row({ usage: usage({ error_rate: rate }) }), "x").find((s) => s.text.endsWith("errors"))?.tone;
    expect(tone(0.04)).toBe("good");
    expect(tone(0.12)).toBe("watch");
    expect(tone(0.3)).toBe("bad");
  });

  it("leaves out an error rate nobody measured", () => {
    expect(texts(row({ usage: usage({ error_rate: null }) })).some((t) => t.endsWith("errors"))).toBe(false);
  });

  it("says 'never used' for an invoked kind nothing ever ran", () => {
    expect(texts(row({ kind: "skill" }))).toContain("never used");
  });

  it("says nothing about use for kinds that are never invoked", () => {
    expect(texts(row({ kind: "settings" }), "Global")).toEqual(["Settings file", "Global"]);
  });

  it("carries the grade when the artifact was graded", () => {
    expect(texts(row({ kind: "rule", grade: "B", score: 82 }))).toContain("Grade B · 82");
    expect(texts(row({ kind: "rule", grade: "B", score: null }))).toContain("Grade B");
  });
});
