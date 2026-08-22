import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTabState } from "./useTabState";

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("useTabState", () => {
  it("starts from the caller's initial tab when nothing is stored", () => {
    const { result } = renderHook(() => useTabState("setup", "rules"));
    expect(result.current[0]).toBe("rules");
  });

  it("persists the selected tab to sessionStorage under pj.tabs.<key>", () => {
    const { result } = renderHook(() => useTabState("setup", "rules"));
    act(() => result.current[1]("skills"));
    expect(result.current[0]).toBe("skills");
    expect(window.sessionStorage.getItem("pj.tabs.setup")).toBe("skills");
  });

  it("rehydrates from sessionStorage on mount", () => {
    window.sessionStorage.setItem("pj.tabs.setup", "agents");
    const { result } = renderHook(() => useTabState("setup", "rules"));
    expect(result.current[0]).toBe("agents");
  });

  it("keys storage per strip so two strips don't clobber each other", () => {
    const setup = renderHook(() => useTabState("setup", "rules"));
    const analytics = renderHook(() => useTabState("analytics", "top"));

    act(() => setup.result.current[1]("skills"));
    act(() => analytics.result.current[1]("errors"));

    expect(window.sessionStorage.getItem("pj.tabs.setup")).toBe("skills");
    expect(window.sessionStorage.getItem("pj.tabs.analytics")).toBe("errors");
  });

  it("reloads state for the new key when the key changes mid-mount", () => {
    window.sessionStorage.setItem("pj.tabs.b", "second");
    const { result, rerender } = renderHook(({ key }) => useTabState(key, "first"), {
      initialProps: { key: "a" },
    });
    expect(result.current[0]).toBe("first");

    rerender({ key: "b" });
    expect(result.current[0]).toBe("second");
  });
});
