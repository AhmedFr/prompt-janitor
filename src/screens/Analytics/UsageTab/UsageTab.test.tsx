import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { axe } from "vitest-axe";
import { UsageTab } from "./UsageTab";
import { ErrorTooltip } from "./UsageTab.tooltips";
import type { UsageOverview } from "@/lib/ipc";
import type { ErrorRateBar } from "./UsageTab.types";

const fullData: UsageOverview = {
  window_days: 90,
  ranked: [
    {
      kind: "skill",
      target: "adapt",
      artifact_id: 7,
      uses: 9,
      sessions: 4,
      error_rate: 0.11,
      avg_turn_tokens: 1840,
    },
    {
      // Same bare name as the skill above: the backend groups by (kind, target),
      // so these stay two independent rows.
      kind: "agent",
      target: "adapt",
      artifact_id: 8,
      uses: 9,
      sessions: 2,
      error_rate: 0,
      avg_turn_tokens: null,
    },
    {
      kind: "mcp",
      target: "playwright",
      artifact_id: null,
      uses: 4,
      sessions: 1,
      error_rate: 0.5,
      avg_turn_tokens: null,
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

/** More targets than the list shows — it keeps the busiest eight. */
const manyTargets: UsageOverview = {
  ...fullData,
  ranked: Array.from({ length: 12 }, (_, i) => ({
    kind: "skill" as const,
    target: `skill-${i}`,
    artifact_id: null,
    uses: 12 - i,
    sessions: 1,
    error_rate: 0,
    avg_turn_tokens: null,
  })),
};

/** A window with charts to draw but nothing ranked in it. */
const noRanked: UsageOverview = { ...fullData, window_days: 30, ranked: [] };

const emptyData: UsageOverview = {
  window_days: 90,
  ranked: [],
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
  "Top skills, agents and MCP servers",
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

  it("lists each ranked target with its use count, busiest first", () => {
    const { getByRole } = render(<UsageTab />);
    const list = getByRole("list", { name: "Top targets by invocations" });
    const rows = [...list.querySelectorAll("li")].map((li) =>
      [...li.children].map((cell) => cell.textContent),
    );
    // A skill and an agent of the same name are two rows, not one.
    expect(rows).toEqual([
      ["adapt", "9"],
      ["adapt", "9"],
      ["playwright", "4"],
    ]);
  });

  it("lists at most the eight busiest targets", () => {
    mockUseUsageTab.mockReturnValue({ data: manyTargets, loading: false });
    const { getByRole } = render(<UsageTab />);
    const list = getByRole("list", { name: "Top targets by invocations" });
    expect(list.querySelectorAll("li")).toHaveLength(8);
  });

  it("names the window it found no invocations in", () => {
    // "in the window" makes the reader guess which window; the tab is told
    // which one it asked for, so it should say.
    mockUseUsageTab.mockReturnValue({ data: noRanked, loading: false });
    const { getByText } = render(<UsageTab />);
    expect(getByText("No invocations in the last 30 days.")).toBeInTheDocument();
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
