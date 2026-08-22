import { describe, it, expect } from "vitest";
import type { ProjectSessions, TargetRate, UsageOverview, UsageSeries } from "@/lib/ipc";
import {
  errorRateBars,
  isUsageEmpty,
  kindBars,
  kindLabel,
  sessionBars,
  shortDay,
  toStackedSeries,
} from "./usageTab.util";

const top: UsageSeries[] = [
  {
    kind: "skill",
    target: "adapt",
    points: [
      { day: "2026-08-01", count: 3, errors: 0 },
      { day: "2026-08-03", count: 5, errors: 1 },
    ],
  },
  {
    kind: "mcp",
    target: "playwright",
    points: [{ day: "2026-08-02", count: 2, errors: 2 }],
  },
];

describe("toStackedSeries", () => {
  it("emits one row per day across the union of days, in ascending order", () => {
    const rows = toStackedSeries(top);
    expect(rows.map((r) => r.day)).toEqual(["2026-08-01", "2026-08-02", "2026-08-03"]);
  });

  it("zero-fills days a target has no points for", () => {
    const rows = toStackedSeries(top);
    expect(rows).toEqual([
      { day: "2026-08-01", adapt: 3, playwright: 0 },
      { day: "2026-08-02", adapt: 0, playwright: 2 },
      { day: "2026-08-03", adapt: 5, playwright: 0 },
    ]);
  });

  it("sorts days even when the series arrive out of order", () => {
    const rows = toStackedSeries([
      {
        kind: "agent",
        target: "explore",
        points: [
          { day: "2026-08-10", count: 1, errors: 0 },
          { day: "2026-08-02", count: 4, errors: 0 },
        ],
      },
    ]);
    expect(rows).toEqual([
      { day: "2026-08-02", explore: 4 },
      { day: "2026-08-10", explore: 1 },
    ]);
  });

  it("sums duplicate points for the same target and day", () => {
    const rows = toStackedSeries([
      {
        kind: "skill",
        target: "adapt",
        points: [
          { day: "2026-08-01", count: 2, errors: 0 },
          { day: "2026-08-01", count: 3, errors: 0 },
        ],
      },
    ]);
    expect(rows).toEqual([{ day: "2026-08-01", adapt: 5 }]);
  });

  it("returns no rows for no series", () => {
    expect(toStackedSeries([])).toEqual([]);
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

  it("converts the 0–1 rate to a percentage and treats null as zero", () => {
    expect(errorRateBars(rates)).toEqual([
      { target: "playwright", total: 8, pct: 25 },
      { target: "supabase", total: 4, pct: 0 },
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
    top: [],
    by_kind: [],
    sessions_per_project: [],
    mcp_error_rates: [],
  };

  it("is true only when every array is empty", () => {
    expect(isUsageEmpty(empty)).toBe(true);
    expect(isUsageEmpty({ ...empty, top })).toBe(false);
    expect(isUsageEmpty({ ...empty, by_kind: [{ kind: "skill", total: 1, avg_turn_tokens: null }] })).toBe(
      false,
    );
  });
});
