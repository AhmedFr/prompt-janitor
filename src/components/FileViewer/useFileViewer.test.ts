import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useFileViewer } from "./useFileViewer";

afterEach(cleanup);

function pressFind(init: KeyboardEventInit = { key: "f", metaKey: true }) {
  const event = new KeyboardEvent("keydown", { cancelable: true, bubbles: true, ...init });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

describe("useFileViewer", () => {
  it("opens markdown rendered and JSON as source", () => {
    expect(renderHook(() => useFileViewer("markdown", true)).result.current.mode).toBe("rendered");
    expect(renderHook(() => useFileViewer("json", true)).result.current.mode).toBe("source");
  });

  it("follows the format once the read lands", () => {
    // The sheet mounts before the file is read, with no format yet.
    const { result, rerender } = renderHook(({ format }) => useFileViewer(format, true), {
      initialProps: { format: null as "json" | null },
    });
    rerender({ format: "json" });
    expect(result.current.mode).toBe("source");
  });

  it("switches modes on request", () => {
    const { result } = renderHook(() => useFileViewer("markdown", true));
    act(() => result.current.setMode("source"));
    expect(result.current.mode).toBe("source");
  });

  it("honours an initial mode", () => {
    expect(renderHook(() => useFileViewer("markdown", true, "source")).result.current.mode).toBe("source");
  });

  it("opens find on ⌘F and keeps the webview's own find from running", () => {
    const { result } = renderHook(() => useFileViewer("markdown", true));
    const event = pressFind();
    expect(result.current.findOpen).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it("opens find on Ctrl+F too", () => {
    const { result } = renderHook(() => useFileViewer("markdown", true));
    pressFind({ key: "f", ctrlKey: true });
    expect(result.current.findOpen).toBe(true);
  });

  it("asks an open find bar to take focus again on the next ⌘F", () => {
    const { result } = renderHook(() => useFileViewer("markdown", true));
    pressFind();
    const first = result.current.findFocus;
    pressFind();
    expect(result.current.findFocus).toBeGreaterThan(first);
  });

  it("ignores ⌘F while there is nothing to search", () => {
    // Loading, failed, or editing: find has nothing to act on.
    const { result } = renderHook(() => useFileViewer("markdown", false));
    const event = pressFind();
    expect(result.current.findOpen).toBe(false);
    expect(event.defaultPrevented).toBe(false);
  });

  it("ignores a plain F", () => {
    const { result } = renderHook(() => useFileViewer("markdown", true));
    pressFind({ key: "f" });
    expect(result.current.findOpen).toBe(false);
  });

  it("keeps the query across close and reopen, as macOS find does", () => {
    const { result } = renderHook(() => useFileViewer("markdown", true));
    act(() => result.current.openFind());
    act(() => result.current.setQuery("env"));
    act(() => result.current.closeFind());
    expect(result.current.findOpen).toBe(false);
    act(() => result.current.openFind());
    expect(result.current.query).toBe("env");
  });

  it("stops listening once unmounted", () => {
    const { result, unmount } = renderHook(() => useFileViewer("markdown", true));
    unmount();
    const event = pressFind();
    expect(event.defaultPrevented).toBe(false);
    expect(result.current.findOpen).toBe(false);
  });
});
