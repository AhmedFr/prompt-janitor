import { describe, it, expect } from "vitest";
import type { ProjectSessions, RankedTarget, UsageOverview } from "@/lib/ipc";
import {
  inWindow,
  isUsageEmpty,
  kindBars,
  kindLabel,
  percentValue,
  rankedFor,
  sessionBars,
  targetDetail,
  tokenValue,
  windowLabel,
} from "./usageTab.util";

const row = (over: Partial<RankedTarget> & Pick<RankedTarget, "kind" | "target">): RankedTarget => ({
  artifact_id: null,
  uses: 1,
  sessions: 1,
  error_rate: 0,
  avg_turn_tokens: null,
  ...over,
});

const ranked: RankedTarget[] = [
  row({ kind: "skill", target: "adapt", uses: 8, sessions: 3, error_rate: 0.125, avg_turn_tokens: 1840 }),
  row({ kind: "agent", target: "adapt", uses: 6, sessions: 2, error_rate: 0, avg_turn_tokens: 900 }),
  row({ kind: "mcp", target: "playwright", uses: 4, sessions: 1, error_rate: 0.5 }),
  row({ kind: "builtin", target: "Bash", uses: 2, sessions: 1, error_rate: 0.11, avg_turn_tokens: 310 }),
];

describe("rankedFor", () => {
  it("keeps only the asked-for kind", () => {
    expect(rankedFor(ranked, "skill", "uses").map((r) => r.label)).toEqual(["adapt"]);
    expect(rankedFor(ranked, "mcp", "uses").map((r) => r.label)).toEqual(["playwright"]);
  });

  it('ranks every kind together under "all"', () => {
    expect(rankedFor(ranked, "all", "uses").map((r) => r.id)).toEqual([
      "skill:adapt",
      "agent:adapt",
      "mcp:playwright",
      "builtin:Bash",
    ]);
  });

  it("keys rows by kind and target, so one name in two kinds stays two rows", () => {
    const rows = rankedFor(ranked, "all", "uses");
    expect(rows.filter((r) => r.label === "adapt").map((r) => r.id)).toEqual([
      "skill:adapt",
      "agent:adapt",
    ]);
  });

  it("ranks by uses, busiest first, with the session count alongside", () => {
    expect(rankedFor(ranked, "all", "uses")[0]).toMatchObject({
      id: "skill:adapt",
      label: "adapt",
      value: 8,
      secondary: "3 sessions",
    });
  });

  it("ranks by error rate as a percentage, with the volume it is measured on", () => {
    const rows = rankedFor(ranked, "all", "errors");
    expect(rows.map((r) => [r.label, r.value, r.secondary])).toEqual([
      ["playwright", 50, "4 uses"],
      ["adapt", 12.5, "8 uses"],
      ["Bash", 11, "2 uses"],
    ]);
  });

  it("leaves error-free targets out of the error ranking", () => {
    // A 0% row is not a finding; listing it would push a real one off the list.
    expect(rankedFor(ranked, "all", "errors").some((r) => r.id === "agent:adapt")).toBe(false);
  });

  it("leaves a never-measured error rate out of the error ranking", () => {
    // `null` is "the harness recorded no outcome", which a 0% bar would
    // silently turn into a clean bill of health.
    const unmeasured = [row({ kind: "mcp", target: "railway", uses: 3, error_rate: null })];
    expect(rankedFor(unmeasured, "all", "errors")).toEqual([]);
  });

  it("ranks by average turn tokens, excluding targets the harness never measured", () => {
    const rows = rankedFor(ranked, "all", "tokens");
    expect(rows.map((r) => [r.label, r.value, r.secondary])).toEqual([
      ["adapt", 1840, "8 uses"],
      ["adapt", 900, "6 uses"],
      ["Bash", 310, "2 uses"],
    ]);
    // `playwright` has no measured average — a 0 would read as "free".
    expect(rows.some((r) => r.id === "mcp:playwright")).toBe(false);
  });

  it("lists ten rows by default and honours a smaller limit", () => {
    const many = Array.from({ length: 14 }, (_, i) =>
      row({ kind: "skill", target: `s${i}`, uses: 14 - i }),
    );
    expect(rankedFor(many, "skill", "uses")).toHaveLength(10);
    expect(rankedFor(many, "skill", "uses", 3).map((r) => r.label)).toEqual(["s0", "s1", "s2"]);
  });

  it("keeps tied rows in the order the backend returned them", () => {
    const tied = [
      row({ kind: "skill", target: "first", uses: 5 }),
      row({ kind: "skill", target: "second", uses: 5 }),
      row({ kind: "skill", target: "third", uses: 5 }),
    ];
    expect(rankedFor(tied, "skill", "uses").map((r) => r.label)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("hovers a row with the numbers its bar does not carry", () => {
    expect(rankedFor(ranked, "skill", "uses")[0].title).toBe(
      "3 sessions · 12.5% errors · 1,840 avg tokens",
    );
  });
});

describe("targetDetail", () => {
  it("says an unmeasured token average is unrecorded, not zero", () => {
    expect(targetDetail(row({ kind: "mcp", target: "playwright", uses: 4, sessions: 1 }))).toBe(
      "1 session · 0% errors · avg tokens not recorded",
    );
  });

  it("says an unmeasured error rate is unmeasured, not error-free", () => {
    expect(
      targetDetail(row({ kind: "mcp", target: "railway", uses: 4, error_rate: null })),
    ).toContain("error rate not measured");
  });
});

describe("percentValue", () => {
  it("drops a trailing zero decimal but keeps a meaningful one", () => {
    expect(percentValue(50)).toBe("50%");
    expect(percentValue(12.5)).toBe("12.5%");
  });
});

describe("tokenValue", () => {
  it("rounds to whole tokens and groups them", () => {
    expect(tokenValue(21480.6)).toBe("21,481");
  });
});

describe("kindLabel", () => {
  it("maps all four invocation kinds", () => {
    expect(kindLabel("skill")).toBe("Skills");
    expect(kindLabel("agent")).toBe("Agents");
    expect(kindLabel("mcp")).toBe("MCP");
    expect(kindLabel("builtin")).toBe("Built-in");
  });
});

describe("kindBars", () => {
  it("labels each kind and keeps a null avg_turn_tokens out of the tooltip", () => {
    expect(
      kindBars([
        { kind: "skill", total: 12, avg_turn_tokens: 1840.6 },
        { kind: "mcp", total: 4, avg_turn_tokens: null },
      ]),
    ).toEqual([
      { kind: "skill", label: "Skills", total: 12, avgTurnTokens: 1841 },
      { kind: "mcp", label: "MCP", total: 4, avgTurnTokens: null },
    ]);
  });
});

describe("sessionBars", () => {
  it("drops zero-session projects and keeps the ten busiest, descending", () => {
    const projects: ProjectSessions[] = [
      ...Array.from({ length: 12 }, (_, i) => ({
        path: `/p/${i}`,
        name: `p${i}`,
        sessions: i + 1,
      })),
      { path: "/idle", name: "idle", sessions: 0 },
    ];
    const bars = sessionBars(projects);
    expect(bars).toHaveLength(10);
    expect(bars[0]).toEqual({ path: "/p/11", name: "p11", sessions: 12 });
    expect(bars[bars.length - 1].sessions).toBe(3);
    expect(bars.some((b) => b.name === "idle")).toBe(false);
  });
});

describe("isUsageEmpty", () => {
  const empty: UsageOverview = {
    window_days: 90,
    ranked: [],
    by_kind: [],
    sessions_per_project: [],
    mcp_error_rates: [],
  };

  it("is true only when the window holds nothing at all", () => {
    expect(isUsageEmpty(empty)).toBe(true);
    expect(isUsageEmpty({ ...empty, ranked })).toBe(false);
    expect(
      isUsageEmpty({ ...empty, by_kind: [{ kind: "skill", total: 1, avg_turn_tokens: null }] }),
    ).toBe(false);
  });

  it("reads the backend's four always-present zero kind rows as empty", () => {
    // `by_kind` is always four rows, so its length says nothing about the
    // window — only the totals do.
    expect(
      isUsageEmpty({
        ...empty,
        by_kind: [
          { kind: "skill", total: 0, avg_turn_tokens: null },
          { kind: "agent", total: 0, avg_turn_tokens: null },
          { kind: "mcp", total: 0, avg_turn_tokens: null },
          { kind: "builtin", total: 0, avg_turn_tokens: null },
        ],
      }),
    ).toBe(true);
  });
});

describe("windowLabel", () => {
  it("names the window the copy is about", () => {
    expect(windowLabel(30)).toBe("last 30 days");
    expect(windowLabel(1)).toBe("last day");
  });
});

describe("inWindow", () => {
  it("pins a piece of empty copy to the window that produced it", () => {
    // "nothing found" without a window sends the reader looking for a scan
    // that already ran over a different period.
    expect(inWindow("Nothing was invoked", 7)).toBe("Nothing was invoked in the last 7 days.");
  });
});
