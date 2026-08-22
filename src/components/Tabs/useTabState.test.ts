import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTabState } from "./useTabState";

const IDS = ["rules", "skills", "agents"];

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("useTabState", () => {
  it("starts from the caller's initial tab when nothing is stored", () => {
    const { result } = renderHook(() => useTabState("setup", "rules", IDS));
    expect(result.current[0]).toBe("rules");
  });

  it("persists the selected tab to sessionStorage under pj.tabs.<key>", () => {
    const { result } = renderHook(() => useTabState("setup", "rules", IDS));
    act(() => result.current[1]("skills"));
    expect(result.current[0]).toBe("skills");
    expect(window.sessionStorage.getItem("pj.tabs.setup")).toBe("skills");
  });

  it("rehydrates from sessionStorage on mount", () => {
    window.sessionStorage.setItem("pj.tabs.setup", "agents");
    const { result } = renderHook(() => useTabState("setup", "rules", IDS));
    expect(result.current[0]).toBe("agents");
  });

  it("keys storage per strip so two strips don't clobber each other", () => {
    const setup = renderHook(() => useTabState("setup", "rules", IDS));
    const analytics = renderHook(() => useTabState("analytics", "top", ["top", "errors"]));

    act(() => setup.result.current[1]("skills"));
    act(() => analytics.result.current[1]("errors"));

    expect(window.sessionStorage.getItem("pj.tabs.setup")).toBe("skills");
    expect(window.sessionStorage.getItem("pj.tabs.analytics")).toBe("errors");
  });

  it("reloads state for the new key when the key changes mid-mount", () => {
    window.sessionStorage.setItem("pj.tabs.b", "second");
    const { result, rerender } = renderHook(
      ({ key }: { key: string }) => useTabState(key, "first", ["first", "second"]),
      { initialProps: { key: "a" } },
    );
    expect(result.current[0]).toBe("first");

    rerender({ key: "b" });
    expect(result.current[0]).toBe("second");
  });

  it("falls back to initial when the stored id isn't among validIds", () => {
    window.sessionStorage.setItem("pj.tabs.setup", "removed-tab");
    const { result } = renderHook(() => useTabState("setup", "rules", IDS));
    expect(result.current[0]).toBe("rules");
  });

  it("falls back to the first valid id when neither the stored id nor initial is valid", () => {
    window.sessionStorage.setItem("pj.tabs.setup", "gone");
    const { result } = renderHook(() => useTabState("setup", "also-gone", IDS));
    expect(result.current[0]).toBe("rules");
  });

  it("self-corrects when the active id drops out of validIds after mount", () => {
    const { result, rerender } = renderHook(
      ({ validIds }: { validIds: string[] }) => useTabState("setup", "rules", validIds),
      { initialProps: { validIds: [...IDS, "temp"] } },
    );

    act(() => result.current[1]("temp"));
    expect(result.current[0]).toBe("temp");

    // The tab set shrinks under the already-mounted strip — "temp" no longer exists.
    rerender({ validIds: IDS });
    expect(result.current[0]).toBe("rules");
  });

  it("falls back to the first valid id on self-correction when initial is also gone", () => {
    const { result, rerender } = renderHook(
      ({ validIds }: { validIds: string[] }) => useTabState("setup", "temp", validIds),
      { initialProps: { validIds: ["temp", "rules", "skills"] } },
    );
    expect(result.current[0]).toBe("temp");

    rerender({ validIds: ["rules", "skills"] });
    expect(result.current[0]).toBe("rules");
  });

  it("does not loop when validIds is empty", () => {
    const { result } = renderHook(() => useTabState("setup", "rules", []));
    expect(result.current[0]).toBe("rules");
  });
});
