import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { axe } from "vitest-axe";
import { UsageTab } from "./UsageTab";
import { ErrorTooltip } from "./UsageTab.tooltips";
import type { UsageOverview } from "@/lib/ipc";
import type { ErrorRateBar } from "./UsageTab.types";

const fullData: UsageOverview = {
  top: [
    {
      kind: "skill",
      target: "adapt",
      points: [
        { day: "2026-08-01", count: 3, errors: 0 },
        { day: "2026-08-02", count: 6, errors: 1 },
      ],
    },
    {
      // Same bare name as the skill above: the backend groups by (kind, target),
      // so these must stay two independent lines.
      kind: "agent",
      target: "adapt",
      points: [{ day: "2026-08-02", count: 9, errors: 0 }],
    },
    {
      kind: "mcp",
      target: "playwright",
      points: [{ day: "2026-08-02", count: 4, errors: 2 }],
    },
  ],
  by_kind: [
    { kind: "skill", total: 42, avg_turn_tokens: 1840.4 },
    { kind: "agent", total: 12, avg_turn_tokens: null },
    { kind: "mcp", total: 9, avg_turn_tokens: 620 },
    { kind: "builtin", total: 77, avg_turn_tokens: 310 },
  ],
  sessions_per_project: [
    { path: "/code/janitor", name: "janitor", sessions: 14 },
    { path: "/code/idle", name: "idle", sessions: 0 },
  ],
  mcp_error_rates: [
    { target: "playwright", total: 8, error_rate: 0.25 },
    { target: "supabase", total: 4, error_rate: null },
  ],
};

/** Eight series is what the backend caps `top` at — the chart's worst case. */
const eightSeries: UsageOverview = {
  ...fullData,
  top: Array.from({ length: 8 }, (_, i) => ({
    kind: "skill" as const,
    target: `skill-${i}`,
    points: [{ day: "2026-08-02", count: i + 1, errors: 0 }],
  })),
};

const emptyData: UsageOverview = {
  top: [],
  by_kind: [],
  sessions_per_project: [],
  mcp_error_rates: [],
};

const mockUseUsageTab = vi.fn(() => ({ data: fullData as UsageOverview | null, loading: false }));
vi.mock("./useUsageTab", async (orig) => {
  const mod = await orig<typeof import("./useUsageTab")>();
  return { ...mod, useUsageTab: () => mockUseUsageTab() };
});

const CHART_NAMES = [
  "Top skills, agents and MCP servers over time",
  "Invocations by kind",
  "MCP error rate",
  "Sessions per project",
];

describe("UsageTab", () => {
  beforeAll(() => {
    // Recharts' ResponsiveContainer measures itself with getBoundingClientRect,
    // which jsdom answers with an all-zero rect; give it a plausible size so
    // the charts render instead of collapsing to 0x0.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 640,
      height: 240,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      x: 0,
      y: 0,
      toJSON() {},
    } as DOMRect);
  });

  afterEach(() => {
    cleanup();
    mockUseUsageTab.mockReturnValue({ data: fullData, loading: false });
  });

  it("renders all four chart regions with their accessible names", () => {
    const { getByRole } = render(<UsageTab />);
    for (const name of CHART_NAMES) {
      expect(getByRole("region", { name })).toBeInTheDocument();
    }
  });

  it("labels the invocation kinds with their human names", () => {
    const { getAllByText } = render(<UsageTab />);
    expect(getAllByText("Built-in").length).toBeGreaterThan(0);
  });

  it("draws one legend entry per series, disambiguating colliding names", () => {
    const { container } = render(<UsageTab />);
    // Recharts owns the legend's ordering, so compare the set of labels.
    const legend = [...container.querySelectorAll(".usage-legend__text")]
      .map((el) => el.textContent)
      .sort();
    expect(legend).toEqual(["adapt (agent)", "adapt (skill)", "playwright"]);
  });

  it("lists every series in the table view backing the line chart", () => {
    const { getByRole } = render(<UsageTab />);
    const table = getByRole("table", { name: "Top targets by invocations" });
    const rows = [...table.querySelectorAll("tbody tr")].map((tr) =>
      [...tr.children].map((cell) => cell.textContent),
    );
    // The skill and the agent keep independent totals (9 + 3 vs 9).
    expect(rows).toEqual([
      ["adapt (skill)", "Skills", "9", "1"],
      ["adapt (agent)", "Agents", "9", "0"],
      ["playwright", "MCP", "4", "2"],
    ]);
  });

  it("draws at most five lines but tabulates every series", () => {
    mockUseUsageTab.mockReturnValue({ data: eightSeries, loading: false });
    const { container, getByRole } = render(<UsageTab />);

    // Beyond five lines the chart is a colour-matching puzzle, so the extra
    // series live in the table underneath rather than on top of each other.
    // The legend has one entry per drawn `<Line>`, so it counts them.
    expect(container.querySelectorAll(".usage-legend__text")).toHaveLength(5);

    const table = getByRole("table", { name: "Top targets by invocations" });
    expect(table.querySelectorAll("tbody tr")).toHaveLength(8);
  });

  it("shows the empty state when nothing is indexed", () => {
    mockUseUsageTab.mockReturnValue({ data: emptyData, loading: false });
    const { getByText, queryByRole } = render(<UsageTab />);
    expect(getByText("No usage indexed yet — run a scan")).toBeInTheDocument();
    expect(queryByRole("region", { name: "Invocations by kind" })).not.toBeInTheDocument();
  });

  it("shows a loading placeholder while the overview is in flight", () => {
    mockUseUsageTab.mockReturnValue({ data: null, loading: true });
    const { getByText } = render(<UsageTab />);
    expect(getByText("Loading…")).toBeInTheDocument();
  });

  it("says an unmeasured MCP server is unmeasured, not error-free", () => {
    // Recharts types tooltip payloads loosely; the shape below is what the
    // chart hands the content component for one hovered bar.
    const Tip = ErrorTooltip as unknown as (p: {
      active: boolean;
      payload: { payload: ErrorRateBar }[];
    }) => JSX.Element;
    const bar = (measured: boolean): ErrorRateBar => ({
      target: "supabase",
      total: 4,
      pct: 0,
      measured,
    });

    const { getByText, rerender, container } = render(
      <Tip active payload={[{ payload: bar(false) }]} />,
    );
    expect(getByText("not measured")).toBeInTheDocument();

    rerender(<Tip active payload={[{ payload: bar(true) }]} />);
    expect(container).toHaveTextContent("0.0% of calls errored");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<UsageTab />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
