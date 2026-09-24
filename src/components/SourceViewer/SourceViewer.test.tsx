import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { SourceViewer } from "./index";

afterEach(cleanup);

const SKILL = ["---", "name: adapt", "description: Adapts designs", "---", "# Adapt", "", "Body text."].join("\n");

describe("SourceViewer", () => {
  it("renders a markdown body as markdown", () => {
    render(<SourceViewer content={SKILL} format="markdown" />);
    expect(screen.getByRole("heading", { name: "Adapt" })).toBeInTheDocument();
    expect(screen.getByText("Body text.")).toBeInTheDocument();
  });

  it("shows frontmatter as a key/value list, not as raw YAML", () => {
    const { container } = render(<SourceViewer content={SKILL} format="markdown" />);
    const terms = [...container.querySelectorAll("dt")].map((dt) => dt.textContent);
    expect(terms).toEqual(["name", "description"]);
    expect(screen.getByText("Adapts designs")).toBeInTheDocument();
    expect(container.textContent).not.toContain("---");
  });

  it("says a markdown file has no body when only its frontmatter is there", () => {
    render(<SourceViewer content={"---\nname: x\n---\n"} format="markdown" emptyBody="Only a header." />);
    expect(screen.getByText("Only a header.")).toBeInTheDocument();
  });

  it("draws JSON verbatim in a monospace block, never parsed as markdown", () => {
    const json = '{\n  "# not a heading": true\n}';
    const { container } = render(<SourceViewer content={json} format="json" />);
    const code = container.querySelector("pre");
    expect(code).toHaveTextContent('"# not a heading": true');
    expect(code).toHaveAttribute("data-format", "json");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("draws plain text the same way", () => {
    const { container } = render(<SourceViewer content={"line one\nline two"} format="text" />);
    expect(container.querySelector("pre")?.textContent).toBe("line one\nline two");
  });

  it("says a file is empty rather than drawing nothing", () => {
    render(<SourceViewer content="   " format="text" />);
    expect(screen.getByText("This file is empty.")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<SourceViewer content={SKILL} format="markdown" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
