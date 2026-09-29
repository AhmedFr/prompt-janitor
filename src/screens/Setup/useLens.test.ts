import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
const { getEffectiveRules, getProjectUsage } = vi.hoisted(() => ({
  getEffectiveRules: vi.fn(async () => ({ status: "ok", data: [] })),
  getProjectUsage: vi.fn(async () => ({ status: "ok", data: { ranked: [], sessions_per_day: [] } })),
}));
vi.mock("@/lib/ipc", async () => ({
  ...(await vi.importActual<object>("@/lib/ipc")),
  isTauri: true,
  commands: { getEffectiveRules, getProjectUsage },
}));
const { listeners } = vi.hoisted(() => ({ listeners: [] as Array<() => void> }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (_e: string, cb: () => void) => {
    listeners.push(cb);
    return () => {};
  }),
}));
const scanDone = () => listeners[listeners.length - 1]?.();
import { useLens } from "./useLens";

const project = { harness: "claude_code", path: "/code/web", name: "web", exists: true, session_count: 1, last_session_at: null, artifacts: [] };

describe("useLens", () => {
  it("loads the load order and the project's usage over 90 days", async () => {
    const { result } = renderHook(() => useLens(project));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getEffectiveRules).toHaveBeenCalledWith("claude_code", "/code/web");
    expect(getProjectUsage).toHaveBeenCalledWith("claude_code", "/code/web", 90);
    expect(result.current.usage).toEqual({ ranked: [], sessions_per_day: [] });
  });

  it("fails without sticking on loading when a command rejects", async () => {
    getEffectiveRules.mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useLens(project));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.failed).toBe(true);
  });

  it("fails on an error status and keeps what did load", async () => {
    getProjectUsage.mockResolvedValueOnce({ status: "error", error: "x" } as never);
    const { result } = renderHook(() => useLens(project));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ failed: true, usage: null, effective: [] });
  });

  it("keeps the previous data while a scan-done reload is in flight", async () => {
    const { result } = renderHook(() => useLens(project));
    await waitFor(() => expect(result.current.loading).toBe(false));
    let release: (v: never) => void = () => {};
    getEffectiveRules.mockReturnValueOnce(new Promise((r) => (release = r)) as never);
    await act(async () => scanDone());
    expect(result.current.loading).toBe(true);
    expect(result.current.effective).toEqual([]);
    await act(async () => release({ status: "ok", data: [{ path: "/a" }] } as never));
    await waitFor(() => expect(result.current.effective).toEqual([{ path: "/a" }]));
  });

  it("asks nothing with no lens", () => {
    getEffectiveRules.mockClear();
    const { result } = renderHook(() => useLens(null));
    expect(result.current).toMatchObject({ effective: null, usage: null, loading: false });
    expect(getEffectiveRules).not.toHaveBeenCalled();
  });
});
