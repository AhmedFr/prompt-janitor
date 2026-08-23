import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import type { PanelFix } from "@/lib/ipc";
import { PanelFixes } from "./PanelFixes";

const fixes: PanelFix[] = [
  {
    file_id: "/code/acme-api/CLAUDE.md",
    name: "CLAUDE.md",
    project_name: "acme-api",
    grade: "F",
    issue_count: 6,
  },
  {
    file_id: "/code/web-app/AGENTS.md",
    name: "AGENTS.md",
    project_name: "web-app",
    grade: "D",
    issue_count: 1,
  },
];

describe("PanelFixes", () => {
  afterEach(cleanup);

  it("names each row for a screen reader and counts its issues", () => {
    render(<PanelFixes fixes={fixes} onOpen={() => {}} />);
    expect(screen.getByRole("button", { name: "Open CLAUDE.md in acme-api — grade F, 6 issues" })).toBeInTheDocument();
    expect(screen.getByText("6 issues")).toBeInTheDocument();
    expect(screen.getByText("1 issue")).toBeInTheDocument();
  });

  /**
   * The row used to carry a folder glyph on the left *and* a grade chip on the
   * right — two marks for one fact, on a 360 px row.
   */
  it("marks each row with one grade badge and no project glyph", () => {
    render(<PanelFixes fixes={fixes} onOpen={() => {}} />);
    expect(screen.getByLabelText("Grade F")).toBeInTheDocument();
    expect(screen.getByLabelText("Grade D")).toBeInTheDocument();
    expect(screen.queryByLabelText("acme-api project")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("web-app project")).not.toBeInTheDocument();
  });

  it("hands the clicked file's id to the caller", () => {
    const onOpen = vi.fn();
    render(<PanelFixes fixes={fixes} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "Open AGENTS.md in web-app — grade D, 1 issue" }));
    expect(onOpen).toHaveBeenCalledWith("/code/web-app/AGENTS.md");
  });

  /** A blank space where the list was is ambiguous; "nothing to fix" is an answer. */
  it("says there is nothing to fix rather than showing an empty list", () => {
    render(<PanelFixes fixes={[]} onOpen={() => {}} />);
    expect(screen.getByText("Nothing to fix")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
