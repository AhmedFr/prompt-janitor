import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { TrendEndDot } from "./TrendEndDot";

function renderInSvg(node: React.ReactNode) {
  return render(<svg>{node}</svg>);
}

describe("TrendEndDot", () => {
  afterEach(cleanup);

  it("marks the latest point with a round dot ringed in the card surface", () => {
    const { container } = renderInSvg(<TrendEndDot index={6} lastIndex={6} cx={120} cy={40} />);
    const dot = container.querySelector("circle");
    expect(dot).not.toBeNull();
    // A circle (one radius), never an ellipse: the marker cannot stretch.
    expect(dot).toHaveAttribute("r", "4");
    expect(dot).toHaveAttribute("stroke", "var(--card)");
    expect(dot).toHaveAttribute("stroke-width", "2");
  });

  it("draws nothing on the earlier points", () => {
    const { container } = renderInSvg(<TrendEndDot index={2} lastIndex={6} cx={40} cy={40} />);
    expect(container.querySelector("circle")).toBeNull();
  });

  it("draws nothing when Recharts has no coordinates for the point", () => {
    const { container } = renderInSvg(<TrendEndDot index={6} lastIndex={6} />);
    expect(container.querySelector("circle")).toBeNull();
  });
});
