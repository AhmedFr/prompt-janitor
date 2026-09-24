import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Sparkline } from "./Sparkline";

describe("Sparkline", () => {
  afterEach(cleanup);

  it("keeps the line's stroke width constant however far the svg stretches", () => {
    const { container } = render(<Sparkline data={[60, 70, 65]} />);
    const line = container.querySelector("path[fill='none']");
    expect(line).toHaveAttribute("vector-effect", "non-scaling-stroke");
  });

  it("draws the end marker outside the stretched svg, so it stays a circle", () => {
    const { container } = render(<Sparkline data={[60, 70, 65]} />);
    // An svg <circle> inside a preserveAspectRatio="none" viewBox renders as
    // an ellipse at any width but the viewBox's own; the marker must not be one.
    expect(container.querySelector("circle")).toBeNull();
    const dot = container.querySelector(".sparkline__dot");
    expect(dot).not.toBeNull();
  });

  it("pins the end marker to the last point, as a share of the width", () => {
    const { container } = render(<Sparkline data={[60, 70, 65]} width={220} height={46} />);
    const dot = container.querySelector<HTMLElement>(".sparkline__dot")!;
    // Last x sits at width - pad (3) = 217 of 220.
    expect(dot.style.left).toBe(`${(217 / 220) * 100}%`);
  });

  it("renders a flat series without dividing by zero", () => {
    const { container } = render(<Sparkline data={[50, 50]} />);
    const dot = container.querySelector<HTMLElement>(".sparkline__dot")!;
    expect(dot.style.top).not.toContain("NaN");
  });
});
