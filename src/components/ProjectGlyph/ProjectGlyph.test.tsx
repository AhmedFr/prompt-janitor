import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ProjectGlyph } from "./ProjectGlyph";

describe("ProjectGlyph", () => {
  afterEach(cleanup);

  it("renders the logo image when provided", () => {
    const { container } = render(<ProjectGlyph name="web-app" grade="A" logo="data:image/png;base64,xx" />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "data:image/png;base64,xx");
  });

  it("renders a grade-tinted folder when no logo", () => {
    const { getByRole } = render(<ProjectGlyph name="scripts" grade="F" />);
    const el = getByRole("img");
    expect(el).toHaveAttribute("aria-label", "scripts project");
    expect(el.className).toContain("grade-tint--f");
  });
});
