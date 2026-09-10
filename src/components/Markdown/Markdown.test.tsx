import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { Markdown } from "./index";

afterEach(cleanup);

describe("Markdown", () => {
  it("renders a heading at its own level", () => {
    render(<Markdown source="## Usage" />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Usage");
  });

  it("renders a bullet list as a list with one item per bullet", () => {
    render(<Markdown source={"- a\n- b"} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("renders a numbered list as an ordered list", () => {
    const { container } = render(<Markdown source={"1. a\n2. b"} />);
    expect(container.querySelector("ol")).not.toBeNull();
  });

  it("renders a fenced block as preformatted code", () => {
    const { container } = render(<Markdown source={"```\npnpm check\n```"} />);
    expect(container.querySelector("pre code")).toHaveTextContent("pnpm check");
  });

  it("labels a fenced block with its language", () => {
    const { container } = render(<Markdown source={"```sh\nx\n```"} />);
    expect(container.querySelector("pre")?.getAttribute("data-lang")).toBe("sh");
  });

  it("renders bold text as <strong>", () => {
    const { container } = render(<Markdown source="a **b**" />);
    expect(container.querySelector("strong")).toHaveTextContent("b");
  });

  it("renders a link with its href", () => {
    render(<Markdown source="[docs](https://x.dev)" />);
    expect(screen.getByRole("link", { name: "docs" })).toHaveAttribute("href", "https://x.dev");
  });

  it("renders embedded HTML as visible text, never as markup", () => {
    const { container } = render(<Markdown source="<img src=x onerror=alert(1)>" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
  });

  it("renders nothing for an empty source", () => {
    const { container } = render(<Markdown source="" />);
    expect(container.querySelector(".md")?.children).toHaveLength(0);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<Markdown source={"# Title\n\ntext\n\n- a\n\n> note"} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
