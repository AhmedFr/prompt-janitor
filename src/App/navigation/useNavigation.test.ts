import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useNavigation } from "./useNavigation";

afterEach(cleanup);

describe("useNavigation", () => {
  it("navigates through the legacy resolver and goes back", () => {
    const { result } = renderHook(() => useNavigation());
    act(() => result.current.navigate("detail", "/code/web/CLAUDE.md"));
    expect(result.current.state).toEqual({ route: "setup", target: { open: { fileId: "/code/web/CLAUDE.md" }, tab: "findings" } });
    act(() => result.current.back());
    expect(result.current.state).toEqual({ route: "setup", target: {} });
  });

  it("goes back on ⌘[ but not while typing in a field", () => {
    const { result } = renderHook(() => useNavigation());
    act(() => result.current.navigate("projects"));
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "[", metaKey: true, bubbles: true }));
    });
    expect(result.current.state.route).toBe("projects");
    input.blur();
    input.remove();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "[", metaKey: true }));
    });
    expect(result.current.state.route).toBe("setup");
  });

  it("closes the open item as one history step", () => {
    const { result } = renderHook(() => useNavigation());
    act(() => result.current.push({ route: "setup", target: { open: { artifactId: 4 } } }));
    expect(result.current.canGoBack).toBe(true);
    act(() => result.current.closeItem());
    expect(result.current.state).toEqual({ route: "setup", target: {} });
    expect(result.current.canGoBack).toBe(false);
  });

  it("keeps its callbacks stable across renders", () => {
    const { result } = renderHook(() => useNavigation());
    const first = result.current;
    act(() => result.current.navigate("settings", "ai"));
    expect(result.current.navigate).toBe(first.navigate);
    expect(result.current.back).toBe(first.back);
    expect(result.current.push).toBe(first.push);
    expect(result.current.replace).toBe(first.replace);
    expect(result.current.closeItem).toBe(first.closeItem);
  });
});
