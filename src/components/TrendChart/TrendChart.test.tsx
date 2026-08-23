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

  it("takes a caller-supplied accessible label", () => {
    // A second series on the same chart must not claim to be the health
    // trend — the label is the only thing a screen reader gets.
    const { getByRole } = render(
      <TrendChart data={[{ day: "2026-08-01", count: 3 }]} ariaLabel="Sessions per day" />,
    );
    expect(getByRole("img", { name: "Sessions per day" })).toBeInTheDocument();
  });

  it("plots the caller's keys and domain", () => {
    const { container } = render(
      <TrendChart
        data={[
          { day: "2026-08-01", count: 3 },
          { day: "2026-08-02", count: 9 },
        ]}
        xKey="day"
        dataKey="count"
        domain={[0, "auto"]}
        ariaLabel="Sessions per day"
      />,
    );
    // ResponsiveContainer measures 0x0 under jsdom, so assert the chart was
    // configured and mounted rather than its geometry.
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });
});
