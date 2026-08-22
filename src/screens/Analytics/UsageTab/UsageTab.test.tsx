import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { axe } from "vitest-axe";
import { UsageTab } from "./UsageTab";
import type { UsageOverview } from "@/lib/ipc";

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

  it("lists the top targets in the table view backing the line chart", () => {
    const { getByRole } = render(<UsageTab />);
    const table = getByRole("table", { name: "Top targets by invocations" });
    expect(table).toHaveTextContent("playwright");
    expect(table).toHaveTextContent("adapt");
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

  it("has no accessibility violations", async () => {
    const { container } = render(<UsageTab />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
