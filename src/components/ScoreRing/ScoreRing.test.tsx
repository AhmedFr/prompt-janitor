import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { ScoreRing } from "./ScoreRing";

describe("ScoreRing", () => {
  afterEach(cleanup);

  /** The ring is drawn at 120 on the verdict hero and in onboarding; that art is the reference. */
  it("keeps the 120 px ring exactly as it was", () => {
    render(<ScoreRing score={86} grade="B" size={120} />);
    expect(screen.getByText("B")).toHaveStyle({ fontSize: "32px" });
    expect(screen.getByText("86/100")).toHaveStyle({ fontSize: "12px" });
  });

  /**
   * The panel header draws the ring at 56. A 32 px letter and a 12 px score
   * line do not fit inside a 56 px circle — they spill over the stroke.
   */
  it("scales the letter with the ring", () => {
    render(<ScoreRing score={86} grade="B" size={56} />);
    expect(screen.getByText("B")).toHaveStyle({ fontSize: "15px" });
  });

  /** Under 72 px the two lines collide; the letter alone still answers the question. */
  it("drops the score line on a small ring", () => {
    render(<ScoreRing score={86} grade="B" size={56} />);
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.queryByText("86/100")).not.toBeInTheDocument();
  });

  /** The project header's ring: proportional type, but the score line has a floor. */
  it("keeps the score line readable on a mid-sized ring", () => {
    render(<ScoreRing score={86} grade="B" size={78} />);
    expect(screen.getByText("B")).toHaveStyle({ fontSize: "21px" });
    expect(screen.getByText("86/100")).toHaveStyle({ fontSize: "10px" });
  });

  /** 72 is the smallest ring both lines fit in — the boundary belongs to the score. */
  it("keeps the score line at the 72 px boundary", () => {
    render(<ScoreRing score={86} grade="B" size={72} />);
    expect(screen.getByText("86/100")).toBeInTheDocument();
  });

  /** An unscored ring still has to render something rather than "null/100". */
  it("marks an ungraded ring instead of inventing a grade", () => {
    render(<ScoreRing score={null} grade={null} size={120} />);
    expect(screen.getByText("–")).toBeInTheDocument();
    expect(screen.getByText("–/100")).toBeInTheDocument();
  });
});
