import { describe, expect, it, vi } from "vitest";
import { fireEvent, renderHook } from "@testing-library/react";
import { useStepKeys } from "./useStepKeys";

describe("useStepKeys", () => {
  it("steps down on ⌘↓ and up on ⌘↑", () => {
    const onStep = vi.fn();
    renderHook(() => useStepKeys(onStep, true));
    fireEvent.keyDown(window, { key: "ArrowDown", metaKey: true });
    fireEvent.keyDown(window, { key: "ArrowUp", metaKey: true });
    expect(onStep.mock.calls).toEqual([[1], [-1]]);
  });

  it("claims the keystroke, so the page behind does not scroll", () => {
    renderHook(() => useStepKeys(vi.fn(), true));
    const event = new KeyboardEvent("keydown", { key: "ArrowDown", metaKey: true, cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves a bare arrow alone", () => {
    const onStep = vi.fn();
    renderHook(() => useStepKeys(onStep, true));
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(onStep).not.toHaveBeenCalled();
  });

  it("does nothing while disabled or without a step handler", () => {
    const onStep = vi.fn();
    renderHook(() => useStepKeys(onStep, false));
    renderHook(() => useStepKeys(undefined, true));
    fireEvent.keyDown(window, { key: "ArrowDown", metaKey: true });
    expect(onStep).not.toHaveBeenCalled();
  });

  it("leaves ⌘↑/⌘↓ to a focused text field, where they move the caret", () => {
    const onStep = vi.fn();
    renderHook(() => useStepKeys(onStep, true));
    const field = document.createElement("textarea");
    document.body.appendChild(field);
    fireEvent.keyDown(field, { key: "ArrowUp", metaKey: true });
    field.remove();
    expect(onStep).not.toHaveBeenCalled();
  });

  it("stops listening once unmounted", () => {
    const onStep = vi.fn();
    const { unmount } = renderHook(() => useStepKeys(onStep, true));
    unmount();
    fireEvent.keyDown(window, { key: "ArrowDown", metaKey: true });
    expect(onStep).not.toHaveBeenCalled();
  });
});
