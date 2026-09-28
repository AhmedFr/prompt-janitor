import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FixDiff } from "./FixDiff";

afterEach(cleanup);

describe("FixDiff", () => {
  it("shows the removed and the added text under 'Suggested fix'", () => {
    const { container } = render(<FixDiff from="npm" to="pnpm" />);
    expect(screen.getByRole("heading", { name: "Suggested fix" })).toBeInTheDocument();
    expect(container.querySelector(".d-diff-from")).toHaveTextContent("− npm");
    expect(container.querySelector(".d-diff-to")).toHaveTextContent("+ pnpm");
  });

  it("labels an AI rewrite and shows its note", () => {
    render(<FixDiff from="a" to="b" ai note="Tightened the wording" />);
    expect(screen.getByRole("heading", { name: "AI suggested rewrite" })).toBeInTheDocument();
    expect(screen.getByText("Tightened the wording")).toBeInTheDocument();
  });

  it("omits the removed line for a pure insertion", () => {
    const { container } = render(<FixDiff from="" to="## Examples" />);
    expect(container.querySelector(".d-diff-from")).toBeNull();
  });
});
