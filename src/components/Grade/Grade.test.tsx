import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { Grade } from "./Grade";

describe("Grade", () => {
  afterEach(cleanup);

  it("renders the letter grade", () => {
    render(<Grade grade="A" />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("renders a neutral dash chip when ungraded, not an F-coloured one", () => {
    render(<Grade grade={null} />);
    const chip = screen.getByText("—");
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveClass("grade--none");
    expect(chip).not.toHaveClass("grade--f");
  });

  it("treats an unknown grade string the same as no grade", () => {
    render(<Grade grade={"Z" as never} />);
    expect(screen.getByText("—")).toHaveClass("grade--none");
  });

  it("exposes an accessible label", () => {
    render(<Grade grade="D" />);
    expect(screen.getByLabelText("Grade D")).toBeInTheDocument();
  });
});
