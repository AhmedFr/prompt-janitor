import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { SetupTarget } from "@/App/setupTarget";
import { useSetupTarget } from "./useSetupTarget";

afterEach(cleanup);

describe("useSetupTarget", () => {
  it("holds the value itself when uncontrolled", () => {
    const { result } = renderHook(() => useSetupTarget({ kind: "skill" }));
    act(() => result.current.change({ kind: "agent" }, "push"));
    expect(result.current.value).toEqual({ kind: "agent" });
  });

  it("reports and holds nothing when controlled", () => {
    const onTargetChange = vi.fn();
    const { result, rerender } = renderHook(({ t }) => useSetupTarget(t, onTargetChange), {
      initialProps: { t: { kind: "skill" } as SetupTarget },
    });
    act(() => result.current.change({ kind: "agent" }, "replace"));
    expect(onTargetChange).toHaveBeenCalledWith({ kind: "agent" }, "replace");
    expect(result.current.value).toEqual({ kind: "skill" });
    rerender({ t: { kind: "hook" } });
    expect(result.current.value).toEqual({ kind: "hook" });
  });

  it("follows a new target while uncontrolled (a deep link into a mounted Setup)", () => {
    const { result, rerender } = renderHook(({ t }) => useSetupTarget(t), { initialProps: { t: { kind: "skill" } as SetupTarget } });
    rerender({ t: { kind: "mcp_server" } });
    expect(result.current.value).toEqual({ kind: "mcp_server" });
  });

  it("reads an absent target as nothing selected", () => {
    const { result } = renderHook(() => useSetupTarget(undefined, vi.fn()));
    expect(result.current.value).toEqual({});
  });
});
