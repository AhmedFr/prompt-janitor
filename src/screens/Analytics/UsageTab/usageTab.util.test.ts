import { describe, it, expect } from "vitest";
import type { ProjectSessions, RankedTarget, TargetRate, UsageOverview } from "@/lib/ipc";
import {
  errorRateBars,
  isUsageEmpty,
  kindBars,
  kindLabel,
  rankedKey,
  sessionBars,
  shortDay,
  topRanked,
} from "./usageTab.util";

const ranked: RankedTarget[] = [
  {
    kind: "skill",
    target: "adapt",
    artifact_id: 7,
    uses: 8,
    sessions: 3,
    error_rate: 0.125,
    avg_turn_tokens: 1840,
  },
  {
    kind: "mcp",
    target: "playwright",
    artifact_id: null,
    uses: 2,
    sessions: 1,
    error_rate: 1,
    avg_turn_tokens: null,
  },
];

describe("rankedKey", () => {
  it("keys by kind and target, so a skill and an agent of one name stay apart", () => {
    expect(rankedKey({ kind: "skill", target: "adapt" })).toBe("skill:adapt");
    expect(rankedKey({ kind: "agent", target: "adapt" })).toBe("agent:adapt");
  });
});

describe("topRanked", () => {
  it("keeps the backend's busiest-first order", () => {
    expect(topRanked(ranked).map((r) => r.target)).toEqual(["adapt", "playwright"]);
  });

  it("lists at most eight targets", () => {
    const many: RankedTarget[] = Array.from({ length: 12 }, (_, i) => ({
      ...ranked[0],
      target: `t${i}`,
      uses: 12 - i,
    }));
    expect(topRanked(many)).toHaveLength(8);
    expect(topRanked(many)[7].target).toBe("t7");
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

describe("shortDay", () => {
  it("abbreviates an ISO day without shifting it across time zones", () => {
    expect(shortDay("2026-08-02")).toBe("Aug 2");
    expect(shortDay("2026-01-31")).toBe("Jan 31");
  });

  it("passes anything unparseable straight through", () => {
    expect(shortDay("later")).toBe("later");
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

describe("errorRateBars", () => {
  const rates: TargetRate[] = [
    { target: "playwright", total: 8, error_rate: 0.25 },
    { target: "supabase", total: 4, error_rate: null },
  ];

  it("converts the 0–1 rate to a percentage and marks an unmeasured row", () => {
    // A missing rate is not a clean 0% — the harness recorded no outcome at
    // all — so the row carries the distinction the chart greys it out on.
    expect(errorRateBars(rates)).toEqual([
      { target: "playwright", total: 8, pct: 25, measured: true },
      { target: "supabase", total: 4, pct: 0, measured: false },
    ]);
  });

  it("keeps the backend's busiest-first order", () => {
    expect(errorRateBars(rates).map((b) => b.target)).toEqual(["playwright", "supabase"]);
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
