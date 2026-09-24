import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { FindBar } from "./index";
import type { FindBarProps } from "./FindBar.types";

afterEach(cleanup);

function setup(overrides: Partial<FindBarProps> = {}) {
  const props: FindBarProps = {
    query: "env",
    onQueryChange: vi.fn(),
    count: 5,
    current: 1,
    onNext: vi.fn(),
    onPrev: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  const outer = vi.fn();
  render(
    <div onKeyDown={outer}>
      <FindBar {...props} />
    </div>,
  );
  return { props, outer, input: screen.getByRole("searchbox", { name: "Find in file" }) };
}

describe("FindBar", () => {
  it("takes focus when it opens", () => {
    const { input } = setup();
    expect(input).toHaveFocus();
  });

  it("takes focus back when asked again, as ⌘F does while find is open", () => {
    const { rerender } = render(<FindBar query="x" onQueryChange={vi.fn()} count={0} current={-1} onNext={vi.fn()} onPrev={vi.fn()} onClose={vi.fn()} focusSignal={0} />);
    const input = screen.getByRole("searchbox");
    input.blur();
    rerender(<FindBar query="x" onQueryChange={vi.fn()} count={0} current={-1} onNext={vi.fn()} onPrev={vi.fn()} onClose={vi.fn()} focusSignal={1} />);
    expect(input).toHaveFocus();
  });

  it("reads the position as 'n of m', counting from one", () => {
    setup({ count: 5, current: 1 });
    expect(screen.getByText("2 of 5")).toBeInTheDocument();
  });

  it("says so when a query matches nothing", () => {
    setup({ count: 0, current: -1 });
    expect(screen.getByText("No matches")).toBeInTheDocument();
  });

  it("shows no count before anything is typed", () => {
    setup({ query: "", count: 0, current: -1 });
    expect(screen.queryByText("No matches")).toBeNull();
  });

  it("reports what is typed", () => {
    const { input, props } = setup();
    fireEvent.change(input, { target: { value: "key" } });
    expect(props.onQueryChange).toHaveBeenCalledWith("key");
  });

  it("moves to the next match on Enter and the previous on Shift+Enter", () => {
    const { input, props } = setup();
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(props.onNext).toHaveBeenCalledTimes(1);
    expect(props.onPrev).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape without letting it reach the sheet behind", () => {
    // The sheet also closes on Escape; one press should close find, not both.
    const { input, props, outer } = setup();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(props.onClose).toHaveBeenCalled();
    expect(outer).not.toHaveBeenCalled();
  });

  it("disables the arrows when there is nothing to move between", () => {
    setup({ count: 0, current: -1 });
    expect(screen.getByRole("button", { name: "Previous match" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next match" })).toBeDisabled();
  });

  it("wires the arrows and the close button", () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Next match" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous match" }));
    fireEvent.click(screen.getByRole("button", { name: "Close find" }));
    expect(props.onNext).toHaveBeenCalled();
    expect(props.onPrev).toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it("has no accessibility violations", async () => {
    setup();
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
