import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ViewingSwitcher } from "./ViewingSwitcher";

afterEach(cleanup);

const projects = [
  { path: "/code/api", name: "api", lastSessionAt: "2026-09-20T00:00:00Z" },
  { path: "/code/web", name: "web", lastSessionAt: "2026-09-26T00:00:00Z" },
];

describe("ViewingSwitcher", () => {
  it("reads All setup with no lens", () => {
    render(<ViewingSwitcher projects={projects} lens={null} onChange={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: /Viewing: All setup/ })).toBeInTheDocument();
  });

  it("names the lensed project", () => {
    render(<ViewingSwitcher projects={projects} lens="/code/web" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: /as Claude Code sees web/ })).toBeInTheDocument();
  });

  it("lists projects most recently active first and reports a pick", () => {
    const onChange = vi.fn();
    render(<ViewingSwitcher projects={projects} lens={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("combobox", { name: /Viewing/ }));
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options[0]).toMatch(/All setup/);
    expect(options[1]).toMatch(/web/);
    fireEvent.click(screen.getByRole("option", { name: /web/ }));
    expect(onChange).toHaveBeenCalledWith("/code/web");
  });

  it("clears back to All setup", () => {
    const onChange = vi.fn();
    render(<ViewingSwitcher projects={projects} lens="/code/web" onChange={onChange} />);
    fireEvent.click(screen.getByRole("combobox", { name: /as Claude Code sees web/ }));
    fireEvent.click(screen.getByRole("option", { name: /All setup/ }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("marks the current choice and shows no counts", () => {
    render(<ViewingSwitcher projects={projects} lens="/code/web" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("combobox", { name: /as Claude Code sees web/ }));
    expect(screen.getByRole("option", { name: "web" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("filters a long project list by name", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      path: `/code/p${i}`,
      name: `project-${i}`,
      lastSessionAt: null,
    }));
    render(<ViewingSwitcher projects={many} lens={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Viewing/ }));
    fireEvent.change(screen.getByPlaceholderText("Filter…"), { target: { value: "project-11" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });
});
