import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SummaryLine } from "./SummaryLine";

afterEach(cleanup);

const base = { grade: "C" as const, items: 84, counts: { never: 3, errors: 1, cost: 0 }, active: "all" as const };

describe("SummaryLine", () => {
  it("reads grade, item count, and only the non-zero filters", () => {
    render(<SummaryLine {...base} onFilter={vi.fn()} />);
    expect(screen.getByText("C")).toBeInTheDocument();
    expect(screen.getByText("84 items")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3 never used" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 erroring" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /costly/ })).toBeNull();
  });

  it("toggles a filter on, and off again", () => {
    const onFilter = vi.fn();
    const { rerender } = render(<SummaryLine {...base} onFilter={onFilter} />);
    fireEvent.click(screen.getByRole("button", { name: "3 never used" }));
    expect(onFilter).toHaveBeenLastCalledWith("never");
    rerender(<SummaryLine {...base} active="never" onFilter={onFilter} />);
    expect(screen.getByRole("button", { name: "3 never used" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "3 never used" }));
    expect(onFilter).toHaveBeenLastCalledWith("all");
  });

  it("keeps an active filter visible even when its count drops to zero", () => {
    render(<SummaryLine {...base} counts={{ never: 0, errors: 0, cost: 0 }} active="errors" onFilter={vi.fn()} />);
    expect(screen.getByRole("button", { name: "0 erroring" })).toHaveAttribute("aria-pressed", "true");
  });

  it("says 1 item in the singular and shows no badge before the first scan", () => {
    render(<SummaryLine {...base} grade={null} items={1} onFilter={vi.fn()} />);
    expect(screen.getByText("1 item")).toBeInTheDocument();
    expect(screen.queryByText("C")).toBeNull();
  });
});
