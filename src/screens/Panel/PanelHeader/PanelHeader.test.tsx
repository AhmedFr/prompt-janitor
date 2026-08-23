import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import type { PanelSnapshot } from "@/lib/ipc";
import { PanelHeader } from "./PanelHeader";

const NOW = new Date("2026-08-23T12:00:00.000Z");

const snapshot = (o: Partial<PanelSnapshot> = {}): PanelSnapshot => ({
  has_data: true,
  overall_grade: "A",
  overall_score: 93,
  delta: -2,
  last_scan_at: "2026-08-23T10:00:00.000Z",
  top_fixes: [],
  never_used_skills: 0,
  mcp_erroring: 0,
  sessions_today: 0,
  ...o,
});

describe("PanelHeader", () => {
  afterEach(cleanup);

  it("turns the grade into a verdict, with the score and the delta beside it", () => {
    render(<PanelHeader snapshot={snapshot()} now={NOW} />);
    expect(screen.getByText("Good enough")).toBeInTheDocument();
    expect(screen.getByText("93/100")).toBeInTheDocument();
    expect(screen.getByText("▼ 2 since last scan")).toBeInTheDocument();
    expect(screen.getByText("Scanned 2h ago")).toBeInTheDocument();
  });

  /** An ungraded setup drawn as a ring reads as a score, and "No data" painted like an A is a lie. */
  it("offers the first scan instead of a ring before there is data", () => {
    render(<PanelHeader snapshot={snapshot({ has_data: false, last_scan_at: null })} now={NOW} />);
    expect(screen.getByText("No scan yet")).toBeInTheDocument();
    expect(screen.queryByText("Good enough")).not.toBeInTheDocument();
  });
});
