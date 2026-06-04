import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Grade } from "./Grade";

describe("Grade", () => {
  it("renders the letter grade", () => {
    render(<Grade grade="A" />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("renders an en dash when ungraded", () => {
    render(<Grade grade={null} />);
    expect(screen.getByText("–")).toBeInTheDocument();
  });

  it("exposes an accessible label", () => {
    render(<Grade grade="D" />);
    expect(screen.getByLabelText("Grade D")).toBeInTheDocument();
  });
});
