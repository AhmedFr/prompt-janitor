import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { TrendTooltip } from "./TrendTooltip";

const SEP_18_NOON = String(Date.UTC(2026, 8, 18, 12, 0, 0) / 1000);

function payloadFor(point: object, dataKey = "score") {
  // The one field of Recharts' payload entry the tooltip reads: the row itself.
  return [{ payload: point, dataKey, value: (point as Record<string, number>)[dataKey] }];
}

describe("TrendTooltip", () => {
  afterEach(cleanup);

  it("renders nothing while no point is hovered", () => {
    const { container } = render(
      <TrendTooltip active={false} payload={payloadFor({ t: SEP_18_NOON, score: 72 })} xKey="t" dataKey="score" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for a row that lacks the plotted value, rather than NaN", () => {
    const { container } = render(
      <TrendTooltip active payload={payloadFor({ t: SEP_18_NOON })} xKey="t" dataKey="score" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("leads with the value and dates it underneath", () => {
    const { getByText } = render(
      <TrendTooltip active payload={payloadFor({ t: SEP_18_NOON, score: 72 })} xKey="t" dataKey="score" />,
    );
    expect(getByText("72")).toHaveClass("trend-tip__value");
    expect(getByText(/^Sep 18,/)).toHaveClass("trend-tip__label");
  });

  it("adds the caller's detail line for the hovered value", () => {
    const { getByText } = render(
      <TrendTooltip
        active
        payload={payloadFor({ t: SEP_18_NOON, score: 72 })}
        xKey="t"
        dataKey="score"
        valueDetail={(v) => `Grade ${v >= 70 ? "C" : "D"}`}
      />,
    );
    expect(getByText("Grade C")).toBeInTheDocument();
  });

  it("reads the caller's keys for a non-score series", () => {
    const { getByText } = render(
      <TrendTooltip
        active
        payload={payloadFor({ day: "2026-08-01", count: 9 }, "count")}
        xKey="day"
        dataKey="count"
      />,
    );
    expect(getByText("9")).toBeInTheDocument();
    expect(getByText("Aug 1")).toBeInTheDocument();
  });
});
