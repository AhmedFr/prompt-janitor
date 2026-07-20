import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { RadarChart } from "./RadarChart";
import type { DimensionScore } from "@/lib/ipc";

const dims: DimensionScore[] = [
  { dimension: "Consistency", score: 80 },
  { dimension: "Format", score: 65 },
  { dimension: "Clarity", score: 90 },
  { dimension: "Structure", score: 55 },
  { dimension: "Examples", score: 70 },
];

describe("RadarChart", () => {
  afterEach(cleanup);

  it("renders the dimension scorecard for all five dimensions", () => {
    const { getByRole } = render(<RadarChart data={dims} grade="D" />);
    // Recharts' ResponsiveContainer can measure 0x0 under jsdom, so assert
    // the labeled wrapper rather than inner SVG geometry.
    expect(getByRole("img", { name: "Dimension scorecard" })).toBeInTheDocument();
  });

  it("exposes an accessible label via getByLabelText", () => {
    const { getByLabelText } = render(<RadarChart data={dims} grade="A" />);
    expect(getByLabelText("Dimension scorecard")).toBeInTheDocument();
  });
});
