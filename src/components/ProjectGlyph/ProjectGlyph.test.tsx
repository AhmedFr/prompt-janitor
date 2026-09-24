import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { ProjectGlyph } from "./ProjectGlyph";

describe("ProjectGlyph", () => {
  afterEach(cleanup);

  it("renders the logo image when provided", () => {
    const { container } = render(<ProjectGlyph name="web-app" grade="A" logo="data:image/png;base64,xx" />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "data:image/png;base64,xx");
  });

  it("falls back to the folder when the logo fails to load", () => {
    const { container, getByRole } = render(
      <ProjectGlyph name="web-app" grade="B" logo="data:image/png;base64,broken" />,
    );
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(getByRole("img")).toHaveAttribute("aria-label", "web-app project");
  });

  it("tries a new logo again after a previous one failed", () => {
    const { container, rerender } = render(
      <ProjectGlyph name="web-app" grade="B" logo="data:image/png;base64,broken" />,
    );
    fireEvent.error(container.querySelector("img")!);
    rerender(<ProjectGlyph name="web-app" grade="B" logo="data:image/png;base64,fixed" />);
    expect(container.querySelector("img")).toHaveAttribute("src", "data:image/png;base64,fixed");
  });

  it("renders a grade-tinted folder when no logo", () => {
    const { getByRole } = render(<ProjectGlyph name="scripts" grade="F" />);
    const el = getByRole("img");
    expect(el).toHaveAttribute("aria-label", "scripts project");
    expect(el.className).toContain("grade-tint--f");
  });
});
