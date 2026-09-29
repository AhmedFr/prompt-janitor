import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { StepButtons } from "./index";

afterEach(cleanup);

describe("StepButtons", () => {
  it("steps to the previous and next item", () => {
    const onStep = vi.fn();
    render(<StepButtons onStep={onStep} />);
    fireEvent.click(screen.getByRole("button", { name: "Next item" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous item" }));
    expect(onStep.mock.calls).toEqual([[1], [-1]]);
  });

  it("holds both buttons while disabled", () => {
    const onStep = vi.fn();
    render(<StepButtons onStep={onStep} disabled />);
    expect(screen.getByRole("button", { name: "Previous item" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next item" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next item" }));
    expect(onStep).not.toHaveBeenCalled();
  });

  it("names the shortcut in each button's tooltip", () => {
    render(<StepButtons onStep={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Previous item" })).toHaveAttribute("title", "Previous item (⌘↑)");
    expect(screen.getByRole("button", { name: "Next item" })).toHaveAttribute("title", "Next item (⌘↓)");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<StepButtons onStep={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
