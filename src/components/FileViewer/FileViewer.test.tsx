import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { FileViewer } from "./index";
import type { FileViewerProps } from "./FileViewer.types";

afterEach(cleanup);

const SKILL = ["---", "name: adapt", "description: Adapts designs", "---", "# Adapt", "", "Resize the grid."].join("\n");
const MCP = '{\n  "command": "npx",\n  "env": { "KEY": "••••••" }\n}';

function view(overrides: Partial<FileViewerProps> = {}) {
  const props: FileViewerProps = {
    name: "SKILL.md",
    content: SKILL,
    format: "markdown",
    path: "/Users/a/.claude/skills/adapt/SKILL.md",
    loading: false,
    error: null,
    ...overrides,
  };
  return render(<FileViewer {...props} />);
}

describe("FileViewer", () => {
  it("opens markdown rendered, with the source one click away", () => {
    view();
    expect(screen.getByRole("heading", { name: "Adapt" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rendered" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Source" }));
    const source = screen.getByRole("region", { name: "SKILL.md source" });
    expect(source.textContent).toContain("name: adapt");
  });

  it("shows a JSON file as source only, and names its language", () => {
    view({ name: ".mcp.json", content: MCP, format: "json", path: "/a/.mcp.json" });
    expect(screen.queryByRole("button", { name: "Rendered" })).toBeNull();
    expect(screen.getByText("JSON")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: ".mcp.json source" })).toBeInTheDocument();
  });

  it("says how long the file is", () => {
    view({ content: "a\nb\nc", format: "text", path: "/a/notes" });
    expect(screen.getByText("3 lines · 5 B")).toBeInTheDocument();
  });

  it("says it is reading while the read is in flight", () => {
    view({ content: null, format: null, loading: true });
    expect(screen.getByText("Reading SKILL.md…")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });

  it("explains a failed read and offers to try again", () => {
    const onRetry = vi.fn();
    view({ content: null, format: null, error: "Command get_artifact_source not allowed by ACL", onRetry });
    expect(screen.getByText("Couldn't open SKILL.md")).toBeInTheDocument();
    expect(screen.getByText("Command get_artifact_source not allowed by ACL")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("names no language before it knows the format", () => {
    // A failed read has no format; "Plain text" would be a guess stated as fact.
    view({ content: null, format: null, error: "nope" });
    expect(screen.queryByText("Plain text")).toBeNull();
  });

  it("draws no empty bar over a failed read", () => {
    const { container } = view({ content: null, format: null, error: "nope" });
    expect(container.querySelector(".fv__bar")).toBeNull();
  });

  it("says so when the file is empty", () => {
    view({ content: "  \n", format: "text", path: "/a/empty.txt" });
    expect(screen.getByText("This file is empty.")).toBeInTheDocument();
  });

  it("opens find from its button and counts the matches", () => {
    view({ content: MCP, format: "json", path: "/a/.mcp.json", name: ".mcp.json" });
    fireEvent.click(screen.getByRole("button", { name: "Find in file" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Find in file" }), { target: { value: "key" } });
    expect(screen.getByText("1 of 1")).toBeInTheDocument();
  });

  it("closes find on Escape without closing anything else", () => {
    view();
    fireEvent.click(screen.getByRole("button", { name: "Find in file" }));
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" });
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("draws the caller's actions in its bar", () => {
    view({ actions: <button type="button">Edit</button> });
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("swaps the body for an editor, and drops the mode toggle and find", () => {
    view({ editor: <textarea aria-label="Skill markdown" /> });
    expect(screen.getByRole("textbox", { name: "Skill markdown" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rendered" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Find in file" })).toBeNull();
  });

  it("has no accessibility violations, rendered or as source", async () => {
    const { container } = view();
    expect(await axe(container)).toHaveNoViolations();
    fireEvent.click(screen.getByRole("button", { name: "Source" }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
