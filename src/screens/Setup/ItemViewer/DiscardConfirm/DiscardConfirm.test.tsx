import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { DiscardConfirm } from "./index";

afterEach(cleanup);

describe("DiscardConfirm", () => {
  it("asks whether to discard unsaved changes", () => {
    render(<DiscardConfirm onKeep={vi.fn()} onDiscard={vi.fn()} />);
    expect(screen.getByRole("alertdialog", { name: "Discard unsaved changes?" })).toHaveTextContent(
      "The edits in the editor have not been written to the file.",
    );
  });

  it("discards on confirm", () => {
    const onDiscard = vi.fn();
    const onKeep = vi.fn();
    render(<DiscardConfirm onKeep={onKeep} onDiscard={onDiscard} />);
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onDiscard).toHaveBeenCalledOnce();
    expect(onKeep).not.toHaveBeenCalled();
  });

  it("keeps editing on cancel", () => {
    const onDiscard = vi.fn();
    const onKeep = vi.fn();
    render(<DiscardConfirm onKeep={onKeep} onDiscard={onDiscard} />);
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(onKeep).toHaveBeenCalledOnce();
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<DiscardConfirm onKeep={vi.fn()} onDiscard={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
