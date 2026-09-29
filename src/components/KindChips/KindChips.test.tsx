import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { KindChips } from "./KindChips";

const counts = { all: 12, rule: 3, skill: 9, agent: 0 };

afterEach(cleanup);

describe("KindChips", () => {
  it("renders every chip in the spec's order, with its count", () => {
    render(<KindChips counts={counts} active="all" onChange={vi.fn()} />);
    const names = screen.getAllByRole("radio").map((b) => b.textContent);
    expect(names).toEqual([
      "All12", "Instructions3", "Skills9", "Agents0", "Commands0", "MCP servers0", "Hooks0", "Plugins0", "Config0",
    ]);
  });

  it("disables a chip with nothing in it instead of hiding it", () => {
    render(<KindChips counts={counts} active="all" onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /Agents/ })).toBeDisabled();
  });

  it("selects one kind at a time", () => {
    const onChange = vi.fn();
    render(<KindChips counts={counts} active="all" onChange={onChange} />);
    expect(screen.getByRole("radio", { name: /All/ })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: /Skills/ }));
    expect(onChange).toHaveBeenCalledWith("skill");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<KindChips counts={counts} active="skill" onChange={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
