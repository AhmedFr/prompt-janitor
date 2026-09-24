import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { CountCell, PercentCell, ScopeCell, TokensCell } from "./index";
import { rateTone } from "./cells.util";

/** Error-rate bands as Setup passes them: watch from 10%, bad from 25%. */
const BANDS = { watch: 0.1, bad: 0.25 };

afterEach(cleanup);

describe("rateTone", () => {
  it("is unknown when there is no value", () => {
    expect(rateTone(null, BANDS)).toBe("unknown");
    expect(rateTone(undefined, BANDS)).toBe("unknown");
    expect(rateTone(Number.NaN, BANDS)).toBe("unknown");
  });

  it("is good below the watch line, zero included", () => {
    expect(rateTone(0, BANDS)).toBe("good");
    expect(rateTone(0.099, BANDS)).toBe("good");
  });

  it("is watch from the watch line up to just under the bad line", () => {
    expect(rateTone(0.1, BANDS)).toBe("watch");
    expect(rateTone(0.249, BANDS)).toBe("watch");
  });

  it("is bad at and above the bad line", () => {
    expect(rateTone(0.25, BANDS)).toBe("bad");
    expect(rateTone(1, BANDS)).toBe("bad");
  });
});

describe("PercentCell tones", () => {
  it("carries no tone without thresholds, so an untoned rate stays neutral", () => {
    render(<PercentCell value={0.42} />);
    expect(screen.getByText("42%").closest(".dt-num")).not.toHaveAttribute("data-tone");
  });

  it("marks a healthy rate good", () => {
    render(<PercentCell value={0.02} thresholds={BANDS} />);
    expect(screen.getByText("2%").closest(".dt-num")).toHaveAttribute("data-tone", "good");
  });

  it("marks a rate near the line watch", () => {
    render(<PercentCell value={0.12} thresholds={BANDS} />);
    expect(screen.getByText("12%").closest(".dt-num")).toHaveAttribute("data-tone", "watch");
  });

  it("marks a rate over the line bad, with an icon so colour is not the only signal", () => {
    const { container } = render(<PercentCell value={0.4} thresholds={BANDS} />);
    const cell = screen.getByText("40%").closest(".dt-num");
    expect(cell).toHaveAttribute("data-tone", "bad");
    expect(container.querySelector(".dt-num__alert svg")).not.toBeNull();
  });

  it("says why a bad rate is flagged, for a hover and a screen reader", () => {
    render(<PercentCell value={0.4} thresholds={BANDS} />);
    expect(screen.getByTitle("40% — at or above the 25% line")).toBeInTheDocument();
  });

  it("draws no icon for good or watch", () => {
    const { container } = render(
      <>
        <PercentCell value={0.02} thresholds={BANDS} />
        <PercentCell value={0.12} thresholds={BANDS} />
      </>,
    );
    expect(container.querySelector(".dt-num__alert")).toBeNull();
  });

  it("mutes an unknown rate instead of toning it", () => {
    render(<PercentCell value={null} thresholds={BANDS} />);
    const cell = screen.getByText("—");
    expect(cell).toHaveClass("muted");
    expect(cell).not.toHaveAttribute("data-tone");
  });
});

describe("unknown numbers are muted", () => {
  it("mutes an unknown percentage, count and token count", () => {
    render(
      <>
        <PercentCell value={null} />
        <CountCell value={null} />
        <TokensCell value={null} />
      </>,
    );
    for (const dash of screen.getAllByText("—")) expect(dash).toHaveClass("muted");
  });

  it("does not mute a real zero", () => {
    render(<CountCell value={0} />);
    expect(screen.getByText("0")).not.toHaveClass("muted");
  });
});

describe("ScopeCell layer tints", () => {
  it("tags each layer so the stylesheet can tint it", () => {
    render(
      <>
        <ScopeCell layer="global" />
        <ScopeCell layer="project" projectName="acme-api" />
        <ScopeCell layer="plugin" pluginName="posthog" />
      </>,
    );
    expect(screen.getByText("Global")).toHaveAttribute("data-layer", "global");
    expect(screen.getByText("acme-api")).toHaveAttribute("data-layer", "project");
    expect(screen.getByText("posthog")).toHaveAttribute("data-layer", "plugin");
  });
});

describe("toned cells accessibility", () => {
  it("has no axe violations in any band", async () => {
    const { container } = render(
      <div>
        <PercentCell value={0.02} thresholds={BANDS} />
        <PercentCell value={0.12} thresholds={BANDS} />
        <PercentCell value={0.4} thresholds={BANDS} />
        <PercentCell value={null} thresholds={BANDS} />
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
