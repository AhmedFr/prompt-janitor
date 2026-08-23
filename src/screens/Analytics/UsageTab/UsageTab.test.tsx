import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { render, cleanup, fireEvent, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { UsageTab } from "./UsageTab";
import type { UsageOverview } from "@/lib/ipc";

const fullData: UsageOverview = {
  window_days: 90,
  ranked: [
    {
      kind: "skill",
      target: "adapt",
      artifact_id: 7,
      uses: 9,
      sessions: 4,
      error_rate: 0.5,
      avg_turn_tokens: 1840,
    },
    {
      // Same bare name as the skill above: the backend groups by (kind, target),
      // so these stay two independent rows.
      kind: "agent",
      target: "adapt",
      artifact_id: 8,
      uses: 6,
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
      error_rate: 0.25,
      avg_turn_tokens: 620,
    },
    {
      kind: "builtin",
      target: "Bash",
      artifact_id: null,
      uses: 2,
      sessions: 1,
      error_rate: 0,
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
  mcp_error_rates: [{ target: "playwright", total: 8, error_rate: 0.25 }],
};

/** A 30-day window with charts to draw but nothing ranked in it. */
const noRanked: UsageOverview = { ...fullData, window_days: 30, ranked: [] };

/** A window that ran clean: ranked targets, none of them erroring or measured. */
const noFindings: UsageOverview = {
  ...fullData,
  window_days: 7,
  ranked: [
    {
      kind: "skill",
      target: "adapt",
      artifact_id: 7,
      uses: 3,
      sessions: 1,
      error_rate: 0,
      avg_turn_tokens: null,
    },
  ],
};

const emptyData: UsageOverview = {
  window_days: 90,
  ranked: [],
  by_kind: [],
  sessions_per_project: [],
  mcp_error_rates: [],
};

const mockUseUsageTab = vi.fn((_windowDays: number) => ({
  data: fullData as UsageOverview | null,
  loading: false,
}));
vi.mock("./useUsageTab", async (orig) => {
  const mod = await orig<typeof import("./useUsageTab")>();
  return { ...mod, useUsageTab: (windowDays: number) => mockUseUsageTab(windowDays) };
});

const REGION_NAMES = [
  "Top used",
  "Most errors",
  "Most expensive",
  "Invocations by kind",
  "Sessions per project",
];

/** The rows of one ranked list, as `[label, value, secondary]` triples. */
const rowsOf = (region: HTMLElement): string[][] =>
  [...region.querySelectorAll("li")].map((li) =>
    [...li.querySelectorAll(".rl__label, .rl__value, .rl__secondary")].map(
      (cell) => cell.textContent ?? "",
    ),
  );

const renderTab = (windowDays = 90, navigate = vi.fn()) => ({
  navigate,
  ...render(<UsageTab windowDays={windowDays} navigate={navigate} />),
});

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

  it("renders the three ranked lists and both charts with their accessible names", () => {
    const { getByRole } = renderTab();
    for (const name of REGION_NAMES) {
      expect(getByRole("region", { name })).toBeInTheDocument();
    }
  });

  it("asks for the window the screen is showing", () => {
    renderTab(7);
    expect(mockUseUsageTab).toHaveBeenLastCalledWith(7);
  });

  it("opens on skills, ranked by uses", () => {
    const { getByRole } = renderTab();
    const list = getByRole("region", { name: "Top used" });
    expect(rowsOf(list)).toEqual([["adapt", "9", "4 sessions"]]);
  });

  it("switches the top-used ranking when another kind is picked", () => {
    const { getByRole } = renderTab();
    const list = getByRole("region", { name: "Top used" });

    fireEvent.click(within(list).getByRole("button", { name: "MCP" }));

    expect(rowsOf(list)).toEqual([["playwright", "4", "1 session"]]);
  });

  it("opens the Setup tab that holds the kind on screen", () => {
    const { getByRole, navigate } = renderTab();
    const list = getByRole("region", { name: "Top used" });

    fireEvent.click(within(list).getByRole("button", { name: "MCP" }));
    fireEvent.click(within(list).getByRole("button", { name: "Details" }));

    expect(navigate).toHaveBeenCalledWith("setup", "mcp_server");
  });

  it("offers no Setup link for built-in tools — nothing installed them", () => {
    const { getByRole } = renderTab();
    const list = getByRole("region", { name: "Top used" });

    fireEvent.click(within(list).getByRole("button", { name: "Built-in" }));

    expect(within(list).queryByRole("button", { name: "Details" })).not.toBeInTheDocument();
  });

  it("ranks errors as percentages over the volume they are measured on", () => {
    const { getByRole } = renderTab();
    const list = getByRole("region", { name: "Most errors" });
    // The error-free agent row is absent: a 0% row is not a finding.
    expect(rowsOf(list)).toEqual([
      ["adapt", "50%", "9 uses"],
      ["playwright", "25%", "4 uses"],
    ]);
  });

  it("ranks the most expensive targets by measured average turn tokens", () => {
    const { getByRole } = renderTab();
    const list = getByRole("region", { name: "Most expensive" });
    expect(rowsOf(list)).toEqual([
      ["adapt", "1,840", "9 uses"],
      ["playwright", "620", "4 uses"],
    ]);
  });

  it("names the window each list found nothing in", () => {
    mockUseUsageTab.mockReturnValue({ data: noFindings, loading: false });
    const { getByText } = renderTab(7);
    expect(getByText("No errors recorded in the last 7 days.")).toBeInTheDocument();
    expect(getByText("No token averages recorded in the last 7 days.")).toBeInTheDocument();
  });

  it("says which kind the window held nothing of", () => {
    mockUseUsageTab.mockReturnValue({ data: noRanked, loading: false });
    const { getByText } = renderTab(30);
    expect(getByText("Nothing was invoked in the last 30 days.")).toBeInTheDocument();
  });

  it("blames the kind, not the window, when only this kind is empty", () => {
    mockUseUsageTab.mockReturnValue({ data: noFindings, loading: false });
    const { getByRole, getByText } = renderTab(7);
    const list = getByRole("region", { name: "Top used" });

    fireEvent.click(within(list).getByRole("button", { name: "Agents" }));

    expect(getByText("No agents were invoked in the last 7 days.")).toBeInTheDocument();
  });

  it("shows the empty state when nothing is indexed", () => {
    mockUseUsageTab.mockReturnValue({ data: emptyData, loading: false });
    const { getByText, queryByRole } = renderTab();
    expect(getByText("No usage indexed yet — run a scan")).toBeInTheDocument();
    expect(queryByRole("region", { name: "Invocations by kind" })).not.toBeInTheDocument();
  });

  it("shows a loading placeholder while the overview is in flight", () => {
    mockUseUsageTab.mockReturnValue({ data: null, loading: true });
    const { getByText } = renderTab();
    expect(getByText("Loading…")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderTab();
    expect(await axe(container)).toHaveNoViolations();
  });
});
