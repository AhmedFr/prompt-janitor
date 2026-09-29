import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
const { getEffectiveRules, getProjectUsage } = vi.hoisted(() => ({
  getEffectiveRules: vi.fn(async () => ({ status: "ok", data: [] })),
  getProjectUsage: vi.fn(async () => ({ status: "ok", data: { ranked: [], sessions_per_day: [] } })),
}));
vi.mock("@/lib/ipc", async () => ({
  ...(await vi.importActual<object>("@/lib/ipc")),
  isTauri: true,
  commands: { getEffectiveRules, getProjectUsage },
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
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

  it("asks nothing with no lens", () => {
    getEffectiveRules.mockClear();
    const { result } = renderHook(() => useLens(null));
    expect(result.current).toMatchObject({ effective: null, usage: null, loading: false });
    expect(getEffectiveRules).not.toHaveBeenCalled();
  });
});
