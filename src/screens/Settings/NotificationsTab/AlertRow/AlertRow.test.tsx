import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AlertRow } from "./AlertRow";

describe("AlertRow", () => {
  afterEach(cleanup);

  it("shows its label and detail and exposes the toggle as a named switch", () => {
    render(<AlertRow label="Weekly digest" detail="A summary of the week's changes" on onToggle={vi.fn()} />);
    expect(screen.getByText("A summary of the week's changes")).toBeInTheDocument();
    const toggle = screen.getByRole("switch", { name: "Weekly digest" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(toggle).toHaveClass("on");
  });

  it("reports a click and reflects the off state", () => {
    const onToggle = vi.fn();
    render(<AlertRow label="Weekly digest" detail="d" on={false} onToggle={onToggle} />);
    const toggle = screen.getByRole("switch", { name: "Weekly digest" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
