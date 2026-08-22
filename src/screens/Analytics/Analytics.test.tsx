import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { Analytics } from "./Analytics";
import type { Analytics as AnalyticsData } from "@/lib/ipc";

vi.mock("@/lib/ipc", async (orig) => {
  const mod = await orig<typeof import("@/lib/ipc")>();
  return { ...mod, isTauri: true };
});

const fullData: AnalyticsData = {
  overall_score: 78,
  overall_grade: "B",
  overall_delta: 4,
  files_tracked: 23,
  project_count: 5,
  issues_fixed_total: 61,
  issues_fixed_auto: 40,
  issues_fixed_manual: 21,
  open_issues: 9,
  open_critical: 2,
  grade_distribution: [
    { grade: "A", count: 6 },
    { grade: "B", count: 8 },
    { grade: "C", count: 5 },
    { grade: "D", count: 3 },
    { grade: "F", count: 1 },
  ],
  trend: [
    { t: "1700000000", score: 62 },
    { t: "1700086400", score: 70 },
    { t: "1700172800", score: 78 },
  ],
  common_issues: [
    { title: "Missing examples", files_affected: 10 },
    { title: "Inconsistent formatting", files_affected: 5 },
  ],
};

// Spy so we can assert what range the toolbar toggle requests, same shape as
// Prompts.test.tsx mocking usePromptsList.
const mockUseAnalytics = vi.fn((_rangeDays: number) => ({ data: fullData, loading: false }));
vi.mock("./useAnalytics", async (orig) => {
  const mod = await orig<typeof import("./useAnalytics")>();
  return { ...mod, useAnalytics: (rangeDays: number) => mockUseAnalytics(rangeDays) };
});

// The Usage tab has its own suite; here it only needs to be reachable, and
// stubbing it keeps this screen's tests off the harness-usage IPC call.
vi.mock("./UsageTab", () => ({ UsageTab: () => <div>usage panel</div> }));

describe("Analytics", () => {
  beforeAll(() => {
    // Recharts' ResponsiveContainer sizes itself from getBoundingClientRect;
    // jsdom returns an all-zero rect by default, which would keep the chart
    // at 0x0 and suppress bar rendering. Give it a plausible size so the
    // grade-distribution bars actually render for the assertion below.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 480,
      height: 200,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      x: 0,
      y: 0,
      toJSON() {},
    } as DOMRect);
  });

  afterEach(cleanup);

  it("renders the four stat tiles", () => {
    const { getByText } = render(<Analytics navigate={vi.fn()} />);
    expect(getByText("78")).toBeInTheDocument(); // Overall score
    expect(getByText("23")).toBeInTheDocument(); // Files tracked
    expect(getByText("61")).toBeInTheDocument(); // Issues fixed (total)
    expect(getByText("9")).toBeInTheDocument(); // Open issues
  });

  it("renders one bar per grade in the distribution chart", () => {
    const { container } = render(<Analytics navigate={vi.fn()} />);
    expect(container.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(5);
  });

  it("defaults to the 30d range and switches to 90d on click", () => {
    const { getByRole } = render(<Analytics navigate={vi.fn()} />);
    expect(getByRole("button", { name: "30d" })).toHaveClass("on");

    fireEvent.click(getByRole("button", { name: "90d" }));

    expect(mockUseAnalytics).toHaveBeenLastCalledWith(90);
    expect(getByRole("button", { name: "90d" })).toHaveClass("on");
    expect(getByRole("button", { name: "30d" })).not.toHaveClass("on");
  });

  it("defaults to the Quality view and switches to Usage on click", () => {
    const { getByRole, getByText, queryByRole } = render(<Analytics navigate={vi.fn()} />);
    expect(getByRole("button", { name: "Quality" })).toHaveClass("on");

    fireEvent.click(getByRole("button", { name: "Usage" }));

    expect(getByText("usage panel")).toBeInTheDocument();
    expect(getByRole("button", { name: "Usage" })).toHaveClass("on");
    // The range toggle only windows the quality metrics, so it steps aside.
    expect(queryByRole("group", { name: "Time range" })).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<Analytics navigate={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
