import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { RuleLink } from "./RuleLink";
import type { EffectiveRule } from "@/lib/ipc";

const rule = (o: Partial<EffectiveRule> = {}): EffectiveRule => ({
  layer: "project",
  path: "/repo/web/CLAUDE.md",
  name: "web CLAUDE.md",
  grade: "C",
  file_id: "f-web",
  ...o,
});

describe("RuleLink", () => {
  afterEach(cleanup);

  it("shows the layer, name, path and grade", () => {
    render(<RuleLink rule={rule()} navigate={vi.fn()} />);
    expect(screen.getByText("Project")).toBeInTheDocument();
    expect(screen.getByText("web CLAUDE.md")).toBeInTheDocument();
    expect(screen.getByLabelText("Grade C")).toBeInTheDocument();
  });

  it("says 'ungraded' in words for a rule the grader has no verdict on", () => {
    render(<RuleLink rule={rule({ grade: null })} navigate={vi.fn()} />);
    expect(screen.getByText("ungraded")).toBeInTheDocument();
    // No grade chip masquerading as an F.
    expect(screen.queryByText("F")).not.toBeInTheDocument();
  });

  it("navigates to the graded file when there is one", () => {
    const navigate = vi.fn();
    render(<RuleLink rule={rule()} navigate={navigate} />);
    fireEvent.click(screen.getByRole("button"));
    expect(navigate).toHaveBeenCalledWith("detail", "f-web");
  });

  it("is inert when the grader never saw the file", () => {
    render(<RuleLink rule={rule({ file_id: null })} navigate={vi.fn()} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
