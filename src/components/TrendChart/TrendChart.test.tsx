import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { TrendChart } from "./TrendChart";
import type { TrendPoint } from "@/lib/ipc";

const points: TrendPoint[] = [
  { t: "1700000000", score: 62 },
  { t: "1700086400", score: 70 },
  { t: "1700172800", score: 81 },
];

describe("TrendChart", () => {
  afterEach(cleanup);

  it("renders the health trend chart", () => {
    const { getByRole } = render(<TrendChart data={points} />);
    // Recharts' ResponsiveContainer can measure 0x0 under jsdom, so assert
    // the labeled wrapper rather than inner SVG geometry.
    expect(getByRole("img", { name: "Health trend" })).toBeInTheDocument();
  });

  it("exposes an accessible label via getByLabelText", () => {
    const { getByLabelText } = render(<TrendChart data={points} />);
    expect(getByLabelText("Health trend")).toBeInTheDocument();
  });

  it("renders with an empty data set without throwing", () => {
    const { getByRole } = render(<TrendChart data={[]} />);
    expect(getByRole("img", { name: "Health trend" })).toBeInTheDocument();
  });
});
